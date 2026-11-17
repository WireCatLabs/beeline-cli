import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, expect, it } from "vitest"
import { run } from "./program.js"
import { strictBeeline } from "./testing/fake-beeline.js"
import { record } from "./testing/records.js"

const asked: string[] = []
const beeline = async (url: string | URL | Request) => {
  const path = new URL(String(url)).pathname
  asked.push(path)
  return path.endsWith("/download")
    ? new Response(new Uint8Array([1, 2, 3]))
    : Response.json([record(1), record(2, { phone: "9000000001" })])
}

const ran = async (argv: string[]) => {
  const out: string[] = []
  const err: string[] = []
  const code = await run(argv, {
    streams: { data: (text) => out.push(text), diagnostic: (text) => err.push(text) },
    tty: false,
    fetch: strictBeeline(beeline),
  })
  return { code, out: out.join("\n"), err: err.join("\n") }
}

let folder: string

beforeEach(async () => {
  process.env.BEELINE_TOKEN = "test-token"
  folder = mkdtempSync(join(tmpdir(), "beeline-download-"))
  expect((await ran(["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z"])).code).toBe(0)
  asked.length = 0
})

afterEach(() => {
  delete process.env.BEELINE_TOKEN
})

const firstCall = async () => {
  const listed = JSON.parse((await ran(["work", "meetings", "list", "--offline", "--json"])).out).items
  return listed[0] as { id: string; ref: string; provider_id: string }
}

it("saves one call's recording to a new private file, by id or by the ref meetings list prints", async () => {
  const call = await firstCall()
  const output = join(folder, "call.mp3")
  const saved = await ran(["work", "meetings", "download", call.ref, "--output", output, "--json"])
  expect(saved.code, saved.err).toBe(0)
  expect(JSON.parse(saved.out).item).toEqual({
    meeting: Number(call.id),
    provider_id: call.provider_id,
    output,
    bytes: 3,
  })
  expect([...readFileSync(output)]).toEqual([1, 2, 3])
  if (process.platform !== "win32") expect(statSync(output).mode & 0o777).toBe(0o600)
  expect(asked).toHaveLength(1)
  expect(asked[0]).toMatch(new RegExp(`/v2/records/${call.provider_id}/download$`))
})

it("never writes over a file, and asks Beeline nothing for a call the profile does not have", async () => {
  const call = await firstCall()
  const output = join(folder, "kept.mp3")
  writeFileSync(output, "kept")
  const refused = await ran(["work", "meetings", "download", call.id, "--output", output, "--json"])
  expect(refused.code).not.toBe(0)
  expect(refused.out + refused.err).toMatch(/already exists/)
  expect(readFileSync(output, "utf8")).toBe("kept")

  asked.length = 0
  const missing = await ran(["work", "meetings", "download", "99999", "--output", join(folder, "x.mp3"), "--json"])
  expect(missing.code).not.toBe(0)
  expect(missing.out + missing.err).toMatch(/no call 99999/)
  expect(asked).toEqual([])
})

it("finds a client's calls by the number their title holds, as the README shows", async () => {
  const found = await ran(["work", "meetings", "list", "title:*79000000001", "--offline", "--json"])
  expect(found.code, found.err).toBe(0)
  expect(JSON.parse(found.out).items.map((call: { title: string }) => call.title)).toEqual([
    "Исходящий звонок · Test Manager ↔ +79000000001",
  ])
})
