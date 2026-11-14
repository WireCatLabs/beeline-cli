import { CliError } from "@wirecat/cli-base"
import type { Pcm } from "@wirecat/cli-core/speech"
import { afterEach, beforeEach, expect, it } from "vitest"
import type { Speech } from "./commands/transcribe.js"
import { run } from "./program.js"
import { record } from "./testing/records.js"

const beeline = async (url: string | URL | Request) =>
  new URL(String(url)).pathname.endsWith("/download")
    ? new Response(new Uint8Array([7]))
    : Response.json([record(1, { duration: 3_000 }), record(2, { duration: 10_000 }), record(3, { duration: 10_000 })])

const ran = async (argv: string[], options: Record<string, unknown> = {}) => {
  const out: string[] = []
  const err: string[] = []
  const code = await run(argv, {
    streams: { data: (text) => out.push(text), diagnostic: (text) => err.push(text) },
    tty: false,
    fetch: beeline,
    ...options,
  })
  return { code, out: out.join("\n"), err: err.join("\n") }
}

const channel = (tag: number): Pcm => ({ samples: new Float32Array(8000 * 10).fill(tag), rate: 8000 })

const speech = (overrides: Partial<Speech> = {}): Speech => ({
  findModel: ((id: string) => (id === "gigaam-v3" ? { id } : undefined)) as Speech["findModel"],
  isInstalled: () => true,
  modelsDirectory: () => "/models",
  localSpeechRecognitionModel: ((model: string) => ({ engine: "sherpa-onnx", model, version: "1" })) as never,
  decodeChannels: async () => ({ channels: [channel(1), channel(2)], mixed: false }),
  recognizeLocalPieces: async (_model: string, pcm: Pcm) =>
    pcm.samples[0] === 1 ? [{ start: 0, end: 2, text: "Здравствуйте" }] : [{ start: 2.5, end: 4, text: "Слушаю" }],
  ...overrides,
})

beforeEach(async () => {
  process.env.BEELINE_TOKEN = "test-token"
  expect((await ran(["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z"])).code).toBe(0)
})

afterEach(() => {
  delete process.env.BEELINE_TOKEN
})

it("transcribes the newest calls of five seconds or more, at most --max-meetings, and says how many remain", async () => {
  const done = await ran(["work", "meetings", "transcribe", "--max-meetings", "1", "--json"], { speech: speech() })
  expect(done.code, done.err).toBe(0)
  expect(JSON.parse(done.out).item).toMatchObject({ transcribed: 1, remaining: 1, failed: [] })

  const listed = JSON.parse((await ran(["work", "meetings", "list", "--json"])).out).items
  const newest = listed.find((meeting: { id: string }) => meeting.id) as { id: string }
  const transcript = JSON.parse((await ran(["work", "meetings", "transcript", newest.id, "--json"])).out).items[0]
  expect(transcript.lines.map(({ speaker }: { speaker: string }) => speaker)).toEqual(["Менеджер", "Клиент"])
})

it("transcribes the calls a query names, again with --replace, and lists one that is not two channels", async () => {
  const listed = JSON.parse((await ran(["work", "meetings", "list", "--json"])).out).items as { id: string }[]
  const id = listed[0]?.id
  expect((await ran(["work", "meetings", "transcribe", `id:${id}`, "--json"], { speech: speech() })).code).toBe(0)

  const skipped = await ran(["work", "meetings", "transcribe", `id:${id}`, "--json"], { speech: speech() })
  expect(JSON.parse(skipped.out).item.transcribed).toBe(0)

  const mono = speech({ decodeChannels: async () => ({ channels: [channel(1)], mixed: true }) })
  const again = await ran(
    ["work", "meetings", "transcribe", `id:${id}`, "--replace", "--model", "gigaam-v3", "--json"],
    {
      speech: mono,
    },
  )
  expect(JSON.parse(again.out).item.failed).toEqual([
    { meeting: Number(id), reason: "recording.not-stereo", message: "the recording is not two separate channels" },
  ])
})

it("says how to download a speech model that is not on this computer", async () => {
  const done = await ran(["work", "meetings", "transcribe", "--json"], { speech: speech({ isInstalled: () => false }) })

  expect(done.code).not.toBe(0)
  expect(done.err).toContain("beeline models download gigaam-v3")
})

it("refuses an unknown model and a field the query does not know", async () => {
  const model = await ran(["work", "meetings", "transcribe", "--model", "whisper", "--json"], { speech: speech() })
  expect(model.err).toContain("no speech model whisper")

  const field = await ran(["work", "meetings", "transcribe", "manager:Тестов", "--json"], { speech: speech() })
  expect(field.code).not.toBe(0)
})

it("lists the speech models it can use", async () => {
  const models = await ran(["models", "list", "--json"])

  expect(models.code, models.err).toBe(0)
  expect(models.out).toContain("gigaam-v3")
})

it("transcribes inside its own recorded run, which counts the downloads", async () => {
  const done = await ran(["work", "meetings", "transcribe", "--max-meetings", "1", "--record", "--json"], {
    speech: speech(),
  })
  expect(done.code, done.err).toBe(0)
  const runId = JSON.parse(done.out).meta.run_id as string
  expect(runId).toContain("meetings-transcribe")
  const shown = JSON.parse((await ran(["runs", "show", runId, "--json"])).out).item
  expect(shown).toMatchObject({ command: "meetings transcribe", status: "success", requests: 1 })
})

it("a later sync that lists a transcribed call again keeps its transcript", async () => {
  expect((await ran(["work", "meetings", "transcribe", "--json"], { speech: speech() })).code).toBe(0)
  expect((await ran(["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z"])).code).toBe(0)

  const listed = JSON.parse((await ran(["work", "meetings", "list", "--json"])).out).items as { id: string }[]
  const read = await Promise.all(listed.map(({ id }) => ran(["work", "meetings", "transcript", id, "--json"])))
  expect(read.filter((one) => one.code === 0 && JSON.parse(one.out).items.length > 0)).toHaveLength(2)
})

it("says the speech model is missing as not_found, with its own reason", async () => {
  const missing = await ran(["work", "meetings", "transcribe", "--json"], {
    speech: speech({ isInstalled: () => false }),
  })
  expect(JSON.parse(missing.err).error).toMatchObject({ code: "not_found", reason: "model.not-downloaded" })
})

it("a deadline that stops the speech engine mid-call answers what it finished, not a failed call", async () => {
  const deadline = new AbortController()
  const recognizeLocalPieces = (async (_model: string, _pcm: Pcm, options?: { signal?: AbortSignal }) => {
    deadline.abort(new DOMException("the run's deadline passed", "TimeoutError"))
    if (options?.signal?.aborted) throw new CliError("timeout", "local speech recognition was interrupted")
    return []
  }) as Speech["recognizeLocalPieces"]
  const done = await ran(["work", "meetings", "transcribe", "--replace", "--json"], {
    speech: speech({ recognizeLocalPieces }),
    signal: deadline.signal,
  })
  expect(done.code, done.err).toBe(0)
  const answer = JSON.parse(done.out)
  expect(answer.item).toMatchObject({ transcribed: 0, failed: [], stopped: true, remaining: 2 })
  expect(answer.meta.complete).toBe(false)
  expect(answer.next[0]).toMatchObject({ command: "meetings transcribe" })
})

it("search meetings finds a word in the transcripts and cites the call", async () => {
  expect((await ran(["work", "meetings", "transcribe", "--json"], { speech: speech() })).code).toBe(0)
  const found = await ran(["work", "search", "meetings", "слушаю", "--json"])
  expect(found.code, found.err).toBe(0)
  const hits = JSON.parse(found.out).items as { excerpt: string; ref: string }[]
  expect(hits.length).toBeGreaterThan(0)
  expect(hits[0]?.excerpt).toContain("Слушаю")
  expect(JSON.parse((await ran(["work", "search", "meetings", "доставка", "--json"])).out).items).toEqual([])
  const side = async (query: string) =>
    JSON.parse((await ran(["work", "search", "meetings", query, "--json"])).out).items.length
  expect(await side("from:Клиент слушаю")).toBeGreaterThan(0)
  expect(await side("from:Менеджер слушаю")).toBe(0)
})

it("every command that takes a call takes the ref meetings list prints as well as the id", async () => {
  expect((await ran(["work", "meetings", "transcribe", "--json"], { speech: speech() })).code).toBe(0)
  const [call] = JSON.parse((await ran(["work", "meetings", "list", "duration_ms>=5000", "--json"])).out).items as {
    id: string
    ref: string
  }[]
  expect(call?.ref).toMatch(/^meeting:\d+\/\d+$/)
  for (const command of ["show", "transcript", "export"]) {
    const byRef = await ran(["work", "meetings", command, String(call?.ref), "--json"])
    const byId = await ran(["work", "meetings", command, String(call?.id), "--json"])
    expect(byRef.code, `${command}: ${byRef.err}`).toBe(0)
    expect(JSON.parse(byRef.out)).toEqual({ ...JSON.parse(byId.out), meta: expect.anything() })
  }
  const wrong = await ran(["work", "meetings", "transcript", "call-7", "--json"])
  expect(JSON.parse(wrong.err).error.message).toContain("meeting:1/375")
  const unknown = await ran(["work", "meetings", "show", "call-7", "--json"])
  expect(JSON.parse(unknown.err).error).toMatchObject({ code: "not_found" })
})

it("indexes what it transcribed, so a search that may not write finds it", async () => {
  expect((await ran(["work", "meetings", "transcribe", "--replace", "--json"], { speech: speech() })).code).toBe(0)
  process.env.BEELINE_READ_ONLY = "1"
  const found = await ran(["work", "search", "meetings", "Здравствуйте", "--json"])
  delete process.env.BEELINE_READ_ONLY
  expect(found.code, found.err).toBe(0)
  expect(JSON.parse(found.out).items.length).toBeGreaterThan(0)
})

it("lists a call over an hour as failed without downloading it", async () => {
  const downloads: string[] = []
  const long = async (url: string | URL | Request) => {
    if (new URL(String(url)).pathname.endsWith("/download")) downloads.push(String(url))
    return new URL(String(url)).pathname.endsWith("/download")
      ? new Response(new Uint8Array([7]))
      : Response.json([record(70, { duration: 2 * 60 * 60 * 1000 })])
  }
  expect((await ran(["long", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z"], { fetch: long })).code).toBe(
    0,
  )
  const done = await ran(["long", "meetings", "transcribe", "--json"], { speech: speech(), fetch: long })
  expect(JSON.parse(done.out).item.failed).toEqual([expect.objectContaining({ reason: "recording.too-long" })])
  expect(downloads).toEqual([])
})
