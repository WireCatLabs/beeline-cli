import { isCliError } from "@wirecat/cli-base"
import type { QueryAst } from "@wirecat/cli-base/query"
import { BASE_REASONS, CRASH_REASON } from "@wirecat/cli-base/standards"
import {
  CORE_REASONS,
  formatMeetingReference,
  type MeetingStore,
  type MeetingTranscriptReceiptStore,
  type Pcm,
  transcribeMeeting,
} from "@wirecat/cli-core"
import type { BeelineApi } from "./beeline-api.js"
import { callTranscriptionSource, type Recognition, type Recognize } from "./call-transcription.js"
import { REASONS } from "./reasons.js"
import { keepRecording } from "./recordings.js"

export interface TranscribeOptions {
  /** Which stored calls, in `meetings list`'s query language. */
  query: QueryAst
  limit: number
  /** Calls that already have a transcript are transcribed again too. */
  replace?: boolean
  now?: () => number
  progress?: (line: string) => void
  /** Checked before each call: once it aborts, the run stops after the call it is on and keeps what it did. */
  signal?: AbortSignal
}

export interface TranscribeReport {
  transcribed: number
  audio_ms: number
  failed: FailedCall[]
  remaining: number
  /** True when the run stopped on its signal before reaching --max-meetings. */
  stopped: boolean
}

export interface FailedCall {
  meeting: number
  ref: string
  reason: string
  message: string
}

export interface TranscribePorts {
  store: MeetingStore & MeetingTranscriptReceiptStore
  accountId: number
  api: Pick<BeelineApi, "recording">
  decode: (bytes: Uint8Array) => Promise<Pcm[]>
  recognize: Recognize
  recognition: Recognition
  /** The folder a transcribed call's recording is kept in; without it the recording is dropped. */
  keepIn?: string
}

/** cli-core's decoder reads at most an hour of audio (`LONGEST_AUDIO_SECONDS`). */
export const LONGEST_CALL_MS = 60 * 60 * 1000

const REGISTERED = [...REASONS, ...CORE_REASONS, ...BASE_REASONS]
const FALLBACK = "the call could not be transcribed"

/**
 * The registered reason and its fixed wording, never the error's own text: an error from a library or a provider may
 * quote a path, a number or what someone said. cli-base lists each code's default reason first.
 */
const failure = (error: unknown): { reason: string; message: string } => {
  if (!isCliError(error)) return { reason: CRASH_REASON, message: FALLBACK }
  const named = typeof error.details.reason === "string" ? error.details.reason : undefined
  const found = named
    ? REGISTERED.find((one) => one.reason === named)
    : BASE_REASONS.find((one) => one.code === error.code)
  const reason = named ?? found?.reason ?? CRASH_REASON
  return { reason, message: found && !found.message.includes("{") ? found.message : FALLBACK }
}

/** Calls the query names that have no transcript yet, newest first; one that fails is reported and the rest go on. */
export const transcribeCalls = async (
  ports: TranscribePorts,
  options: TranscribeOptions,
): Promise<TranscribeReport> => {
  const { store, accountId } = ports
  const calls = (await store.meetings({ accountId, query: options.query })).sort(
    (a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0),
  )
  const pending = []
  const report: TranscribeReport = { transcribed: 0, audio_ms: 0, failed: [], remaining: 0, stopped: false }
  const failed = (meeting: number, reason: string, message: string): FailedCall => ({
    meeting,
    ref: formatMeetingReference({ type: "meeting", accountId, meetingId: meeting }),
    reason,
    message,
  })
  for (const call of calls) {
    const details = await store.meeting(call.id)
    if (!details || !(options.replace || details.transcripts.length === 0)) continue
    // The decoder refuses audio over an hour, so downloading one would fail on every run.
    if ((call.durationMs ?? 0) > LONGEST_CALL_MS)
      report.failed.push(failed(call.id, "recording.too-long", "the call is longer than 60 minutes"))
    else pending.push(call)
  }
  for (const [index, call] of pending.entries()) {
    if (index >= options.limit || options.signal?.aborted) {
      report.remaining = pending.length - index
      report.stopped = index < options.limit
      break
    }
    try {
      const bytes = await ports.api.recording(call.externalId)
      const channels = await ports.decode(bytes)
      const source = callTranscriptionSource(bytes, channels, ports.recognize, ports.recognition)
      const now = (options.now ?? Date.now)()
      await transcribeMeeting(source, store, { accountId, externalId: call.externalId, now }, { apply: true })
      const details = ports.keepIn ? await store.meeting(call.id) : null
      if (ports.keepIn && details) await keepRecording(store, details, bytes, ports.keepIn, now)
      report.transcribed++
      report.audio_ms += call.durationMs ?? 0
      options.progress?.(`${index + 1}/${Math.min(pending.length, options.limit)} meeting ${call.id} transcribed`)
    } catch (error) {
      // The run's deadline stops a download or a recognition halfway, whatever error that throws; the calls finished
      // so far are the answer, not a failure.
      if (options.signal?.aborted) {
        report.remaining = pending.length - index
        report.stopped = true
        break
      }
      if (isCliError(error) && error.code === "cancelled") throw error
      const { reason, message } = failure(error)
      report.failed.push(failed(call.id, reason, message))
      options.progress?.(`${index + 1}/${Math.min(pending.length, options.limit)} meeting ${call.id} failed: ${reason}`)
    }
  }
  return report
}
