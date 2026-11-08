import { CliError } from "@wirecat/cli-base"
import { annotate } from "@wirecat/cli-base/commands"
import { defineQuery, fieldsHelp, parseLucene, validateQuery } from "@wirecat/cli-base/query"
import {
  answerEntity,
  type BaseEnvironment,
  baseContext,
  environmentOf,
  FETCH,
  refuseOffline,
} from "@wirecat/cli-core/cli"
import { MEETING_QUERY, type MeetingStore, type MeetingTranscriptReceiptStore } from "@wirecat/cli-core/meetings"
import { queryWordsAfterOptions } from "@wirecat/cli-core/meetings/cli"
import { Command } from "commander"
import * as v from "valibot"
import type { BeelineApi } from "../beeline.js"
import { configuration } from "../config.js"
import { IDENTITY } from "../identity.js"
import type { TranscribeReport } from "../transcribe-calls.js"
import { DEFAULT_SPEECH_MODEL } from "./models.js"

export type Speech = Pick<
  typeof import("@wirecat/cli-core/speech"),
  | "findModel"
  | "isInstalled"
  | "modelsDirectory"
  | "localSpeechRecognitionModel"
  | "decodeChannels"
  | "recognizeLocalPieces"
>

/** A test hands in its own speech engine here; the real one needs a model hundreds of MB large. */
export interface SpeechEnvironment extends BaseEnvironment {
  speech?: Speech
}

export interface TranscribeDeps {
  store: () => MeetingStore & MeetingTranscriptReceiptStore
  accountId: () => number
  api: () => BeelineApi
  env: () => NodeJS.ProcessEnv
  signal: () => AbortSignal | undefined
  progress: (line: string) => void
  write: (report: TranscribeReport, command: Command) => void
}

const count = (name: string) => (text: string) => {
  const value = Number(text)
  if (!Number.isSafeInteger(value) || value < 0) throw new CliError("validation_error", `${name} takes a whole number`)
  return value
}

/** Without a query: every call of at least five seconds, the owner's choice; shorter ones are mostly no answer. */
export const DEFAULT_QUERY = "duration_ms>=5000"

const GUIDE = "https://github.com/WireCatLabs/cli-core/blob/main/docs/search/query-language.md"

export const callQuery = (text: string) => {
  const context = { command: "meetings transcribe", guide: GUIDE }
  const query = parseLucene(text, { defaultField: "none", ...context })
  validateQuery(query, MEETING_QUERY, context)
  return query
}

const REPORT = v.strictObject({
  transcribed: v.number(),
  audio_seconds: v.number(),
  failed: v.array(v.strictObject({ meeting: v.number(), reason: v.string(), message: v.string() })),
  remaining: v.number(),
  stopped: v.boolean(),
})

export const transcribeCommand = (deps: TranscribeDeps): Command => {
  const command = queryWordsAfterOptions(
    answerEntity(
      annotate(new Command("transcribe"), {
        effects: FETCH,
        cooperative: true,
        partial: true,
        query: defineQuery(MEETING_QUERY),
        examples: [
          `${IDENTITY.command} work meetings transcribe --max-meetings 20 --json`,
          `${IDENTITY.command} work meetings transcribe duration_ms>=60000 --json`,
          `${IDENTITY.command} work meetings transcribe id:4494 --replace --json`,
        ],
      }),
      "call_transcription_report",
      REPORT,
    ),
  )
    .summary("turn call recordings into manager and client dialogues, on this computer")
    .description("download each call's recording and recognize the manager and the client with a local speech model")
    .argument("[query...]", `field:value terms that pick the calls (default ${DEFAULT_QUERY}) — the fields are below`)
    .addHelpText(
      "after",
      `\nChannel 0 of a recording is the manager, channel 1 the client. The calls the query names that have no ` +
        `transcript yet, newest first, at most --max-meetings of them; without a query, ${DEFAULT_QUERY}. A call ` +
        `that fails is listed and the rest go on.\n\n${fieldsHelp(MEETING_QUERY, GUIDE)}`,
    )
    .option("--replace", "transcribe calls that already have a transcript too, replacing it")
    .option("--max-meetings <n>", "at most this many calls transcribed, newest first", count("--max-meetings"), 20)
    .option("--model <model>", "local speech model", DEFAULT_SPEECH_MODEL)
  return command.action(async function (this: Command, words: string[], opts: Record<string, unknown>) {
    const { replace, maxMeetings: limit, model } = opts as { replace?: boolean; maxMeetings: number; model: string }
    const context = baseContext(this, configuration.resolveSettings)
    refuseOffline(this, "Beeline")
    const query = callQuery(words.join(" ").trim() || DEFAULT_QUERY)
    const env = deps.env()
    const speech: Speech = environmentOf<SpeechEnvironment>(this).speech ?? (await import("@wirecat/cli-core/speech"))
    const chosen = speech.findModel(model)
    if (!chosen) throw new CliError("validation_error", `no speech model ${model}; see ${IDENTITY.command} models list`)
    if (!speech.isInstalled(chosen, speech.modelsDirectory(env)))
      throw new CliError(
        "not_found",
        `the speech model ${model} is not on this computer; download it once with ${IDENTITY.command} models download ${model}`,
        { reason: "model.not-downloaded" },
      )
    const { transcribeCalls } = await import("../transcribe-calls.js")
    const recognition = speech.localSpeechRecognitionModel(model)
    const signal = deps.signal()
    // Unbounded: run() already stops this cooperative command at its deadline by its signal, and it answers with what
    // it finished; the run's own deadline would throw that answer away instead.
    const report = await context.run(
      () =>
        transcribeCalls(
          {
            store: deps.store(),
            accountId: deps.accountId(),
            api: deps.api(),
            decode: async (bytes) => {
              const { channels, mixed } = await speech.decodeChannels(bytes)
              if (mixed || channels.length !== 2)
                throw new CliError("invalid_response", "the recording is not two separate channels", {
                  reason: "recording.not-stereo",
                })
              return channels
            },
            recognize: (pcm) => speech.recognizeLocalPieces(model, pcm, { env, ...(signal ? { signal } : {}) }),
            recognition: { engine: recognition.engine, model: recognition.model, version: recognition.version },
          },
          {
            query,
            limit,
            ...(replace ? { replace } : {}),
            progress: deps.progress,
            ...(signal ? { signal } : {}),
          },
        ),
      { unbounded: true },
    )
    deps.write(report, this)
  })
}
