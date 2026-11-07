import { isCliError } from "@wirecat/cli-base"
import { describe, expect, it } from "vitest"
import { BASE_URL, beelineApi, PAGE_SIZE } from "./beeline-api.js"
import { record } from "./testing/records.js"

const TOKEN = "test-token-7f3a"

const answering = (handler: (url: URL) => Response) => {
  const calls: { url: URL; headers: Headers; redirect: RequestInit["redirect"] }[] = []
  const fetch = async (url: string | URL | Request, init: RequestInit = {}) => {
    const parsed = new URL(String(url))
    calls.push({ url: parsed, headers: new Headers(init.headers), redirect: init.redirect })
    return handler(parsed)
  }
  return { fetch, calls }
}

const MB = 1024 * 1024

const streamOf = (chunks: number, chunk: Uint8Array, fail?: Error) => {
  let sent = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent === chunks) return fail ? controller.error(fail) : controller.close()
      sent++
      controller.enqueue(chunk)
    },
  })
}

const stalled = async (_url: string | URL | Request, init: RequestInit = {}) =>
  new Promise<Response>((_, reject) => {
    init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true })
  })

const caught = async (work: Promise<unknown>) => {
  try {
    await work
  } catch (error) {
    if (isCliError(error)) return error
    throw error
  }
  throw new Error("expected a failure")
}

describe("records", () => {
  it("follows the id cursor until a short page, from the given date", async () => {
    const first = Array.from({ length: PAGE_SIZE }, (_, i) => record(i + 1))
    const { fetch, calls } = answering((url) =>
      Response.json(url.searchParams.get("id") === String(PAGE_SIZE) ? [record(101), record(102)] : first),
    )
    const from = new Date("2026-10-01T00:00:00.000Z")
    const seen: string[] = []
    for await (const one of beelineApi(TOKEN, { fetch }).allRecords({ from })) seen.push(one.id)

    expect(seen).toHaveLength(PAGE_SIZE + 2)
    expect(calls.map(({ url }) => url.searchParams.get("id"))).toEqual([null, String(PAGE_SIZE)])
    expect(calls.every(({ url }) => url.searchParams.get("dateFrom") === from.toISOString())).toBe(true)
    expect(calls[0]?.url.href.startsWith(BASE_URL)).toBe(true)
    expect(calls[0]?.headers.get("X-MPBX-API-AUTH-TOKEN")).toBe(TOKEN)
    expect(calls[0]?.redirect).toBe("error")
  })
})

describe("record shape", () => {
  it("takes a date as epoch milliseconds or as an ISO time", async () => {
    const at = Date.UTC(2026, 9, 20, 10)
    const { fetch } = answering(() => Response.json([record(1), { ...record(2), date: new Date(at).toISOString() }]))
    const [first, second] = await beelineApi(TOKEN, { fetch }).records()

    expect(typeof first?.date).toBe("number")
    expect(second?.date).toBe(at)
  })

  it("refuses a record in another shape and names only the fields, never their values", async () => {
    const { fetch } = answering(() =>
      Response.json([record(1), { ...record(2), direction: "SIDEWAYS", abonent: { phone: "70000000005" } }]),
    )
    const error = await caught(beelineApi(TOKEN, { fetch }).records())

    expect(error.code).toBe("invalid_response")
    expect(error.message).toContain("record 2")
    expect(error.message).toContain("direction")
    expect(error.message).not.toContain("SIDEWAYS")
    expect(error.message).not.toContain("70000000005")
  })
})

describe("recordings", () => {
  it("downloads a recording by its id", async () => {
    const { fetch, calls } = answering(() => new Response(new Uint8Array([0xff, 0xfb, 0x90])))
    const bytes = await beelineApi(TOKEN, { fetch }).recording("629303665")

    expect(bytes).toEqual(new Uint8Array([0xff, 0xfb, 0x90]))
    expect(calls[0]?.url.pathname.endsWith("/v2/records/629303665/download")).toBe(true)
  })

  it("refuses a recording over 256 MB that comes with no content-length, without reading it all", async () => {
    const { fetch, calls } = answering(() => new Response(streamOf(300, new Uint8Array(MB))))
    const error = await caught(beelineApi(TOKEN, { fetch }).recording("1"))

    expect(error.details.reason).toBe("recording.too-large")
    expect(calls).toHaveLength(1)
    expect(calls[0]?.redirect).toBe("error")
  })

  it("asks again when the connection breaks halfway through a recording", async () => {
    let calls = 0
    const { fetch } = answering(() =>
      ++calls === 1
        ? new Response(streamOf(1, new Uint8Array([1]), new TypeError("terminated")))
        : new Response(new Uint8Array([1, 2])),
    )
    expect(await beelineApi(TOKEN, { fetch, wait: async () => {} }).recording("1")).toEqual(new Uint8Array([1, 2]))
    expect(calls).toBe(2)
  })

  it("refuses an empty recording instead of saving nothing", async () => {
    const { fetch } = answering(() => new Response(new Uint8Array()))
    const error = await caught(beelineApi(TOKEN, { fetch }).recording("1"))

    expect(error.code).toBe("provider_error")
  })
})

describe("failures", () => {
  it("says Beeline could not be reached, without the address that holds the token", async () => {
    const fetch = async () => {
      throw new TypeError("fetch failed")
    }
    const error = await caught(beelineApi(TOKEN, { fetch, wait: async () => {} }).records())

    expect(error.code).toBe("network_error")
    expect(JSON.stringify(error)).not.toContain(TOKEN)
  })

  it("calls a refused token an authentication error and never repeats it", async () => {
    const { fetch } = answering(() => new Response("{}", { status: 403 }))
    const error = await caught(beelineApi(TOKEN, { fetch }).records())

    expect(error.code).toBe("authentication_error")
    expect(JSON.stringify(error)).not.toContain(TOKEN)
  })

  it("keeps Beeline's error code and drops its description, which can quote a number", async () => {
    const { fetch } = answering(() =>
      Response.json({ errorCode: "UserNotFound", description: "нет абонента 79990001122" }, { status: 400 }),
    )
    const error = await caught(beelineApi(TOKEN, { fetch }).records({ userId: "x" }))

    expect(error.message).toContain("UserNotFound")
    expect(error.message).not.toContain("79990001122")
  })

  it("asks again after a passing server failure, as Beeline's downloads need", async () => {
    let calls = 0
    const { fetch } = answering(() =>
      ++calls === 1 ? new Response("", { status: 500 }) : new Response(new Uint8Array([1])),
    )
    const waits: number[] = []
    const wait = async (ms: number) => {
      waits.push(ms)
    }

    expect(await beelineApi(TOKEN, { fetch, wait, random: () => 0.5 }).recording("1")).toEqual(new Uint8Array([1]))
    expect(waits).toHaveLength(1)
  })

  it("gives up after its retries and says how many attempts it made", async () => {
    const { fetch, calls } = answering(() => new Response("", { status: 503 }))
    const error = await caught(beelineApi(TOKEN, { fetch, wait: async () => {} }).recording("1"))

    expect(error.details).toMatchObject({ retryable: true, attempts: calls.length })
  })

  it("gives up on a request that does not answer in time, as a timeout that may be tried again", async () => {
    let calls = 0
    const fetch = async (url: string | URL | Request, init: RequestInit = {}) => {
      calls++
      return stalled(url, init)
    }
    const timeouts = { listMs: 10, recordingMs: 10 }
    const error = await caught(beelineApi(TOKEN, { fetch, wait: async () => {}, timeouts }).records())

    expect(error).toMatchObject({ code: "timeout", details: { retryable: true, attempts: calls } })
    expect(calls).toBeGreaterThan(1)
  })

  it("stops at once when the run is cancelled, without asking again", async () => {
    const run = new AbortController()
    let calls = 0
    const fetch = async (url: string | URL | Request, init: RequestInit = {}) => {
      calls++
      setTimeout(() => run.abort(), 1)
      return stalled(url, init)
    }
    const error = await caught(beelineApi(TOKEN, { fetch, signal: run.signal }).recording("1"))

    expect(error.code).toBe("cancelled")
    expect(calls).toBe(1)
  })

  it("reads no more of an error answer than a short error code needs", async () => {
    const { fetch } = answering(() => new Response(streamOf(300, new Uint8Array(MB)), { status: 400 }))
    const error = await caught(beelineApi(TOKEN, { fetch }).records())

    expect(error).toMatchObject({ code: "validation_error", details: { status: 400 } })
  })

  it("does not ask again when Beeline refused the request", async () => {
    const { fetch, calls } = answering(() => new Response("{}", { status: 403 }))
    await caught(beelineApi(TOKEN, { fetch, wait: async () => {} }).records())

    expect(calls).toHaveLength(1)
  })
})
