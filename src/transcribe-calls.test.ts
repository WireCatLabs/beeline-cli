import { CliError } from "@wirecat/cli-base"
import type { Pcm, TimedText } from "@wirecat/cli-core/speech"
import { afterEach, expect, it } from "vitest"
import { dialogue } from "./call-transcription.js"
import { callQuery, DEFAULT_QUERY } from "./commands/transcribe.js"
import { run } from "./program.js"
import { openBeelineStore, PROVIDER } from "./store.js"
import { record } from "./testing/records.js"
import { transcribeCalls } from "./transcribe-calls.js"

const RATE = 8000
const channel = (seconds: number, tag: number): Pcm => ({
  samples: new Float32Array(seconds * RATE).fill(tag),
  rate: RATE,
})

/** The manager speaks at 0 s and 6 s, the client answers at 3 s, overlapping the manager's second turn by a second. */
const PIECES: Record<number, TimedText[]> = {
  1: [
    { start: 0, end: 2.5, text: "Здравствуйте, компания «Пример»" },
    { start: 6, end: 9, text: "Проверку делаем за три дня" },
  ],
  2: [{ start: 3, end: 7, text: "Да, слушаю, расскажите" }],
}

afterEach(() => {
  delete process.env.BEELINE_TOKEN
})

it("merges both channels into one dialogue in order of who started speaking", () => {
  const rows = dialogue([PIECES[1] ?? [], PIECES[2] ?? []], 10_000)

  expect(rows.map(({ speaker, startMs }) => [speaker, startMs])).toEqual([
    ["Менеджер", 0],
    ["Клиент", 3000],
    ["Менеджер", 6000],
  ])
})

it("keeps a piece inside the recording and drops one with no text", () => {
  const rows = dialogue(
    [
      [
        { start: 1, end: 12, text: "конец позже записи" },
        { start: 2, end: 3, text: "  " },
      ],
    ],
    10_000,
  )

  expect(rows).toEqual([{ startMs: 1000, endMs: 10_000, text: "конец позже записи", speaker: "Менеджер" }])
})

it("transcribes calls without a transcript, reports a failed one and leaves the rest for the next run", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  expect(
    (
      await run(["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z"], {
        tty: false,
        fetch: async () =>
          Response.json([
            record(1, { duration: 3_000 }),
            record(2, { duration: 10_000 }),
            record(3, { duration: 10_000 }),
            record(4, { duration: 10_000 }),
          ]),
      } as Parameters<typeof run>[1])
    ).valueOf(),
  ).toBe(0)

  const store = await openBeelineStore(process.env)
  try {
    const accountId = await store.accounts.saveAccount({ provider: PROVIDER.name, account: "work" }, { name: "work" })
    const ports = {
      store: store.meetings,
      accountId,
      api: {
        recording: async (id: string) => {
          if (id === "3") throw new CliError("provider_error", "Beeline answered 500", { reason: "beeline.down" })
          return new Uint8Array([Number(id)])
        },
      },
      decode: async () => [channel(10, 1), channel(10, 2)],
      recognize: async (pcm: Pcm) => PIECES[pcm.samples[0] ?? 0] ?? [],
      recognition: { engine: "sherpa-onnx", model: "gigaam-v3" },
    }

    const stopped = await transcribeCalls(ports, {
      query: callQuery(DEFAULT_QUERY),
      limit: 10,
      signal: AbortSignal.abort(),
    })
    expect(stopped).toMatchObject({ transcribed: 0, remaining: 3, stopped: true })

    const deadline = new AbortController()
    const cut = async () => {
      deadline.abort()
      throw new CliError("cancelled", "stopped before Beeline answered")
    }
    const halfway = await transcribeCalls(
      { ...ports, api: { recording: cut } },
      { query: callQuery(DEFAULT_QUERY), limit: 10, signal: deadline.signal },
    )
    expect(halfway).toMatchObject({ transcribed: 0, failed: [], remaining: 3, stopped: true })

    const first = await transcribeCalls(ports, { query: callQuery(DEFAULT_QUERY), limit: 1 })
    expect(first).toMatchObject({ transcribed: 1, failed: [], remaining: 2, stopped: false })

    const second = await transcribeCalls(ports, { query: callQuery(DEFAULT_QUERY), limit: 10 })
    expect(second.transcribed).toBe(1)
    expect(second.failed).toEqual([
      { meeting: expect.any(Number), reason: "beeline.down", message: "Beeline answered 500" },
    ])

    const calls = await store.meetings.meetings({ accountId })
    const lines = await Promise.all(
      calls.map(async (call) => (await store.meetings.meeting(call.id))?.transcripts[0]?.rows.length ?? 0),
    )
    expect(lines.sort()).toEqual([0, 0, 3, 3])
  } finally {
    await store.close()
  }
})
