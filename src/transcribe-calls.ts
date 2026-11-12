import { isCliError } from "@wirecat/cli-base"
import type { QueryAst } from "@wirecat/cli-base/query"
import { type MeetingStore, type MeetingTranscriptReceiptStore, transcribeMeeting } from "@wirecat/cli-core/meetings"
import type { Pcm } from "@wirecat/cli-core/speech"
import type { BeelineApi } from "./beeline-api.js"
import { callTranscriptionSource, type Recognition, type Recognize } from "./call-transcription.js"

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
  audio_seconds: number
  failed: { meeting: number; reason: string; message: string }[]
  remaining: number
  /** True when the run stopped on its signal before reaching --max-meetings. */
  stopped: boolean
}

export interface TranscribePorts {
  store: MeetingStore & MeetingTranscriptReceiptStore
  accountId: number
  api: Pick<BeelineApi, "recording">
  decode: (bytes: Uint8Array) => Promise<Pcm[]>
  recognize: Recognize
  recognition: Recognition
}

/** cli-core's decoder reads at most an hour of audio (`LONGEST_AUDIO_SECONDS`). */
export const LONGEST_CALL_MS = 60 * 60 * 1000

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
  const report: TranscribeReport = { transcribed: 0, audio_seconds: 0, failed: [], remaining: 0, stopped: false }
  for (const call of calls) {
    const details = await store.meeting(call.id)
    if (!details || !(options.replace || details.transcripts.length === 0)) continue
    // The decoder refuses audio over an hour, so downloading one would fail on every run.
    if ((call.durationMs ?? 0) > LONGEST_CALL_MS)
      report.failed.push({
        meeting: call.id,
        reason: "recording.too-long",
        message: "the call is longer than 60 minutes",
      })
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
      await transcribeMeeting(
        source,
        store,
        { accountId, externalId: call.externalId, now: (options.now ?? Date.now)() },
        { apply: true },
      )
      report.transcribed++
      report.audio_seconds += Math.round((call.durationMs ?? 0) / 1000)
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
      const reason = isCliError(error) ? (error.details.reason ?? error.code) : "unexpected"
      report.failed.push({
        meeting: call.id,
        reason: String(reason),
        message: error instanceof Error ? error.message : "the call could not be transcribed",
      })
      options.progress?.(`${index + 1}/${Math.min(pending.length, options.limit)} meeting ${call.id} failed: ${reason}`)
    }
  }
  return report
}
