import { createHash } from "node:crypto"
import type {
  MeetingMediaDescriptor,
  MeetingRecognitionSegment,
  MeetingTranscriptionSource,
} from "@wirecat/cli-core/meetings"
import type { Pcm, TimedText } from "@wirecat/cli-core/speech"

/**
 * Beeline records the subscriber, our manager, on channel 0 and the other party on channel 1 — on outgoing and
 * incoming calls alike (measured 2026-10-31 on one outgoing and two incoming calls).
 */
export const SPEAKERS = ["Менеджер", "Клиент"] as const

export type Recognize = (pcm: Pcm) => Promise<TimedText[]>

export interface Recognition {
  engine: string
  model: string
  version?: string
}

const durationMsOf = (channels: readonly Pcm[]) =>
  Math.floor(channels.reduce((longest, { samples, rate }) => Math.max(longest, (samples.length / rate) * 1000), 0))

/** Both channels as one dialogue, in order of who started speaking: speakers may overlap, as people do on a call. */
export const dialogue = (channels: readonly TimedText[][], durationMs: number): MeetingRecognitionSegment[] =>
  channels
    .flatMap((pieces, channel) =>
      pieces.map(({ start, end, text }) => ({
        startMs: Math.floor(start * 1000),
        endMs: Math.min(durationMs, Math.ceil(end * 1000)),
        text,
        speaker: SPEAKERS[channel] ?? `Канал ${channel + 1}`,
      })),
    )
    .filter(({ startMs, endMs, text }) => endMs > startMs && text.trim())
    .sort((a, b) => a.startMs - b.startMs)

/** One recorded call for cli-core's `transcribeMeeting`: each channel recognized on its own, then merged by time. */
export const callTranscriptionSource = (
  bytes: Uint8Array,
  channels: readonly Pcm[],
  recognize: Recognize,
  recognition: Recognition,
): MeetingTranscriptionSource => {
  const durationMs = durationMsOf(channels)
  const media: MeetingMediaDescriptor = {
    id: createHash("sha256").update(bytes).digest("hex").slice(0, 32),
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    size: bytes.byteLength,
    durationMs,
    format: "mp3",
    sampleRate: channels[0]?.rate ?? 8000,
    channels: channels.length,
    recognition: { ...recognition, timing: "recognition-segments" },
  }
  return {
    describe: async () => media,
    async *segments() {
      const pieces: TimedText[][] = []
      for (const channel of channels) pieces.push(await recognize(channel))
      yield* dialogue(pieces, durationMs)
    },
  }
}
