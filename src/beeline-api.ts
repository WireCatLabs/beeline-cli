import {
  backoffMs,
  CliError,
  isCliError,
  type RetryConfig,
  realSleep,
  type SleepLike,
  wallClock,
} from "@wirecat/cli-base"
import { type FetchLike, providerWaitMs, readJsonResponse, retryableStatus, statusToCode } from "@wirecat/cli-base/http"
import { providerRequest } from "@wirecat/cli-core/cli"
import * as v from "valibot"

export const BASE_URL = "https://cloudpbx.beeline.ru/apis/portal/"

/** Beeline returns at most this many records per call: its API page, as docs/dev/DESIGN.md "The API" cites it. */
export const PAGE_SIZE = 100

const LARGEST_LIST = 4 * 1024 * 1024
const LARGEST_ERROR = 64 * 1024
const LARGEST_RECORDING = 256 * 1024 * 1024

/** Our limits, not Beeline's: a list answers in a second or two, and an hour's stereo recording is tens of MB. */
export const TIMEOUTS = { listMs: 30_000, recordingMs: 120_000 }

/** cli-base's one retry after 250 ms is not enough: a long recording kept failing 500 after it (2026-10-31). */
const RETRY: RetryConfig = { retries: 4, baseDelayMs: 2_000, maxDelayMs: 15_000, maxRetryAfterMs: 30_000 }

const ABONENT = v.object({
  userId: v.string(),
  phone: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  email: v.optional(v.string()),
  department: v.optional(v.string()),
  extension: v.optional(v.string()),
})

/**
 * One call record, as the API page lists its fields (docs/dev/DESIGN.md, "The API"). The page calls `date` a datetime;
 * Beeline sent epoch milliseconds on 2026-10-31, so both are taken. `duration` is milliseconds.
 */
const CALL_RECORD = v.object({
  id: v.string(),
  externalId: v.string(),
  callId: v.optional(v.string()),
  phone: v.string(),
  direction: v.picklist(["INBOUND", "OUTBOUND"]),
  date: v.union([
    v.pipe(v.number(), v.finite()),
    v.pipe(
      v.string(),
      v.isoTimestamp(),
      v.transform((text) => Date.parse(text)),
    ),
  ]),
  duration: v.pipe(v.number(), v.finite(), v.minValue(0)),
  fileSize: v.number(),
  comment: v.optional(v.string()),
  abonent: ABONENT,
})

export type CallRecord = v.InferOutput<typeof CALL_RECORD>
export type Abonent = CallRecord["abonent"]

export interface RecordsQuery {
  /** Records after this id. */
  after?: string
  from?: Date
  to?: Date
  userId?: string
}

/**
 * Read-only on purpose: the API also deletes recordings (`DELETE v2/records/{id}`), and nothing here may call it.
 * The token lives only in the request header; no URL, error or message carries it (WC-SECR-7).
 * Every call is a read, so a failure Beeline may not repeat is tried again: a download answers 500 with an empty body
 * now and then and succeeds on the next try (6 of 20 calls on 2026-10-31).
 */
export const beelineApi = (
  token: string,
  {
    fetch = globalThis.fetch,
    signal,
    wait = realSleep,
    random = Math.random,
    timeouts = TIMEOUTS,
  }: {
    fetch?: FetchLike
    signal?: AbortSignal
    wait?: SleepLike
    random?: () => number
    timeouts?: typeof TIMEOUTS
  } = {},
) => {
  const once = async <T>(
    path: string,
    endpoint: string,
    accept: string,
    attempt: number,
    timeoutMs: number,
    read: (response: Response, signal: AbortSignal) => Promise<T>,
  ): Promise<T | CliError> => {
    const answered = providerRequest(`GET ${endpoint}`, undefined, {
      method: "GET",
      endpointTemplate: endpoint,
      attempt,
    })
    // The limit covers the body too: a download that stalls halfway is the slow case, not a late first byte.
    const deadline = AbortSignal.timeout(timeoutMs)
    const bounded = signal ? AbortSignal.any([signal, deadline]) : deadline
    const broken = (message: string): CliError => {
      if (signal?.aborted) {
        answered({ errorCode: "cancelled" })
        throw new CliError("cancelled", "stopped before Beeline answered")
      }
      if (deadline.aborted) {
        answered({ errorCode: "timeout" })
        return new CliError("timeout", `Beeline did not answer within ${timeoutMs / 1000} s`, { retryable: true })
      }
      answered({ errorCode: "network_error" })
      return new CliError("network_error", message, { retryable: true })
    }
    let response: Response
    try {
      // A redirect would carry the token header to wherever it points.
      response = await fetch(BASE_URL + path, {
        headers: { "X-MPBX-API-AUTH-TOKEN": token, Accept: accept },
        redirect: "error",
        signal: bounded,
      })
    } catch {
      return broken("could not reach Beeline Cloud PBX")
    }
    if (!response.ok) {
      const error = await failure(response)
      answered({ status: response.status, error })
      const asked = providerWaitMs(response.headers, wallClock)
      return asked === undefined
        ? error
        : new CliError(error.code, error.message, { ...error.details, retry_after_ms: asked })
    }
    try {
      const value = await read(response, bounded)
      answered({ status: response.status })
      return value
    } catch (error) {
      if (isCliError(error) && !bounded.aborted) {
        answered({ status: response.status, error })
        throw error
      }
      return broken("the connection to Beeline broke during its answer")
    }
  }

  const request = async <T>(
    path: string,
    endpoint: string,
    accept: string,
    timeoutMs: number,
    read: (response: Response, signal: AbortSignal) => Promise<T>,
  ): Promise<T> => {
    for (let attempt = 1; ; attempt++) {
      const result = await once(path, endpoint, accept, attempt, timeoutMs, read)
      if (!isCliError(result)) return result
      const asked = result.details.retry_after_ms
      if (!result.details.retryable || attempt > RETRY.retries || (asked ?? 0) > RETRY.maxRetryAfterMs)
        throw new CliError(result.code, result.message, { ...result.details, attempts: attempt })
      try {
        await wait(asked ?? backoffMs(attempt, RETRY, random), signal, "retry")
      } catch {
        throw new CliError("cancelled", "stopped while waiting to ask Beeline again")
      }
    }
  }

  const records = async (query: RecordsQuery = {}): Promise<CallRecord[]> => {
    const params = new URLSearchParams()
    if (query.after) params.set("id", query.after)
    if (query.userId) params.set("userId", query.userId)
    if (query.from) params.set("dateFrom", query.from.toISOString())
    if (query.to) params.set("dateTo", query.to.toISOString())
    const search = params.toString()
    const body = await request(
      `records${search ? `?${search}` : ""}`,
      "/records",
      "application/json",
      timeouts.listMs,
      (response, bounded) => readJsonResponse(response, { maxBytes: LARGEST_LIST, signal: bounded }),
    )
    if (!Array.isArray(body)) throw new CliError("invalid_response", "Beeline answered records with something else")
    return body.map((one, index) => {
      const checked = v.safeParse(CALL_RECORD, one)
      if (checked.success) return checked.output
      // Only the field names reach the message: the values are phone numbers and names.
      const fields = [...new Set(checked.issues.map((issue) => v.getDotPath(issue) ?? "record"))].join(", ")
      throw new CliError(
        "invalid_response",
        `Beeline sent call record ${index + 1} of the page in another shape: ${fields}`,
      )
    })
  }

  /** Every record from `from` on, following the id cursor until a short page. */
  async function* allRecords(query: Omit<RecordsQuery, "after"> = {}): AsyncGenerator<CallRecord> {
    let after: string | undefined
    for (;;) {
      const page = await records({ ...query, ...(after ? { after } : {}) })
      yield* page
      const last = page.at(-1)
      if (page.length < PAGE_SIZE || !last) return
      after = last.id
    }
  }

  const recording = async (id: string): Promise<Uint8Array> => {
    const path = `v2/records/${encodeURIComponent(id)}/download`
    const bytes = await request(path, "/v2/records/:id/download", "*/*", timeouts.recordingMs, (response) =>
      readCapped(response, LARGEST_RECORDING),
    )
    if (bytes.byteLength === 0)
      throw new CliError("provider_error", "Beeline sent an empty recording", { reason: "recording.empty" })
    return bytes
  }

  return { records, allRecords, recording }
}

export type BeelineApi = ReturnType<typeof beelineApi>

const tooLarge = () =>
  new CliError("validation_error", "the recording is larger than 256 MB", { reason: "recording.too-large" })

/** Counts the bytes as they come: Beeline may send no `content-length`, and a recording is not read without a cap. */
const readCapped = async (response: Response, maxBytes: number): Promise<Uint8Array> => {
  if (Number(response.headers.get("content-length") ?? 0) > maxBytes) {
    void response.body?.cancel().catch(() => {})
    throw tooLarge()
  }
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of response.body ?? []) {
    size += chunk.byteLength
    if (size > maxBytes) throw tooLarge()
    chunks.push(chunk)
  }
  const bytes = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    bytes.set(chunk, at)
    at += chunk.byteLength
  }
  return bytes
}

/** Only Beeline's error code reaches the message: its description can quote a number (WC-SECR-6). */
const failure = async (response: Response): Promise<CliError> => {
  let errorCode: string | undefined
  try {
    const body = (await readJsonResponse(response, { maxBytes: LARGEST_ERROR })) as { errorCode?: unknown }
    if (typeof body.errorCode === "string" && /^[A-Za-z]{1,64}$/.test(body.errorCode)) errorCode = body.errorCode
  } catch {
    errorCode = undefined
  }
  const status = response.status
  // Beeline answers a wrong token with 403, not 401 (seen 2026-10-31).
  if (status === 401 || status === 403)
    return new CliError(
      "authentication_error",
      "Beeline refused the API token; set a new one with `beeline <profile> session start`",
      { status, reason: "token.refused" },
    )
  return new CliError(statusToCode(status), `Beeline answered ${status}${errorCode ? ` ${errorCode}` : ""}`, {
    status,
    retryable: retryableStatus(status),
    ...(errorCode ? { provider_error: errorCode } : {}),
  })
}
