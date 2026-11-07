import { existsSync, statSync } from "node:fs"
import { Readable } from "node:stream"
import { memoryKeyring } from "@wirecat/cli-base"
import type { FetchLike } from "@wirecat/cli-base/http"
import { storePath } from "@wirecat/cli-core/store"
import { afterEach, expect, it, vi } from "vitest"
import { run } from "./program.js"
import { record } from "./testing/records.js"

let answering: FetchLike | undefined

const ran = async (argv: string[], options: Record<string, unknown> = {}) => {
  const out: string[] = []
  const err: string[] = []
  const code = await run(argv, {
    streams: { data: (text) => out.push(text), diagnostic: (text) => err.push(text) },
    tty: false,
    ...(answering ? { fetch: answering } : {}),
    ...options,
  })
  return { code, out: out.join("\n"), err: err.join("\n") }
}

const beeline = (answer: (url: URL) => Response) => {
  const fetch = vi.fn(async (url: string | URL | Request) => answer(new URL(String(url))))
  answering = fetch
  return fetch
}

afterEach(() => {
  answering = undefined
  delete process.env.BEELINE_TOKEN
})

it("syncs Beeline's call records into the store as meetings with a manager and a client", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  beeline(() => Response.json([record(1), record(2, { direction: "INBOUND" }), record(3)]))

  const synced = await ran(["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z", "--json"])
  expect(synced.code, synced.err).toBe(0)

  const listed = await ran(["work", "meetings", "list", "--json"])
  expect(listed.code, listed.err).toBe(0)
  expect(JSON.parse(listed.out).items).toHaveLength(3)

  const paged = await ran(["work", "meetings", "list", "--limit", "2", "--json"])
  expect(paged.code, paged.err).toBe(0)
  expect(JSON.parse(paged.out)).toMatchObject({ items: [{}, {}], page: { has_more: true } })

  const events = await ran(["work", "events", "list", "--json"])
  expect(events.code, events.err).toBe(0)
  expect(JSON.parse(events.out)).toMatchObject({ items: [{}, {}, {}], page: { has_more: false } })

  const people = await ran(["work", "meetings", "people", "Manager", "--json"])
  expect(people.code, people.err).toBe(0)
  expect(people.out).not.toContain("70000000001@example.test")
})

it("each sync asks again for the three hours before the last one began, so a call in progress then is not lost", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  vi.useFakeTimers({ toFake: ["Date"] })
  const lastSync = Date.UTC(2026, 9, 20, 12)
  vi.setSystemTime(lastSync)
  beeline(() => Response.json([record(1)]))
  expect((await ran(["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z"])).code).toBe(0)

  vi.setSystemTime(lastSync + 3_600_000)
  const inProgress = record(2, { date: lastSync - 600_000 })
  const fetch = beeline(() => Response.json([record(1), inProgress, record(1)]))
  const synced = await ran(["work", "meetings", "sync", "--json"])
  vi.useRealTimers()
  expect(synced.code, synced.err).toBe(0)

  const asked = new URL(fetch.mock.calls[0]?.[0] as string)
  expect(asked.searchParams.get("dateFrom")).toBe(new Date(lastSync - 3 * 3_600_000).toISOString())
  const listed = JSON.parse((await ran(["work", "meetings", "list", "--json"])).out).items as { started_at: string }[]
  expect(listed.filter(({ started_at }) => started_at === new Date(inProgress.date).toISOString())).toHaveLength(1)
})

it("session start keeps a token only after Beeline accepts it, and session end forgets it", async () => {
  const keyring = memoryKeyring()
  beeline((url) => (url.pathname.endsWith("/records") ? new Response("{}", { status: 403 }) : Response.json([])))

  const refused = await ran(["work", "session", "start", "--json"], { keyring, stdin: Readable.from(["wrong\n"]) })
  expect(refused.code).not.toBe(0)
  expect(JSON.parse((await ran(["work", "session", "status", "--json"], { keyring })).out).item.state).toBe("missing")

  beeline(() => Response.json([]))
  const accepted = await ran(["work", "session", "start", "--json"], { keyring, stdin: Readable.from(["right\n"]) })
  expect(accepted.code, accepted.err).toBe(0)
  expect(JSON.parse((await ran(["work", "session", "status", "--json"], { keyring })).out).item).toMatchObject({
    state: "saved",
    token_from: "keyring",
  })

  const checked = await ran(["work", "session", "status", "--check", "--json"], { keyring })
  expect(JSON.parse(checked.out).item.verified).toBe(true)

  const removed = await ran(["work", "session", "end", "--json"], { keyring })
  expect(removed.code, removed.err).toBe(0)
  expect(JSON.parse((await ran(["work", "session", "status", "--json"], { keyring })).out).item.state).toBe("missing")
})

it("session start --credential-storage file keeps the token out of the keyring", async () => {
  const keyring = memoryKeyring()
  beeline(() => Response.json([]))
  const started = await ran(["work", "session", "start", "--credential-storage", "file", "--json"], {
    keyring,
    stdin: Readable.from(["right\n"]),
  })
  expect(started.code, started.err).toBe(0)
  expect(JSON.parse(started.out).item.stored_in).toBe("file")
  expect(keyring.entries.size).toBe(0)
  expect(JSON.parse((await ran(["work", "session", "status", "--json"], { keyring })).out).item.token_from).toBe("file")
})

it("session status --check asks Beeline inside its own recorded run", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  beeline(() => Response.json([]))
  const checked = await ran(["work", "session", "status", "--check", "--record", "--json"])
  expect(checked.code, checked.err).toBe(0)
  const runId = JSON.parse(checked.out).meta.run_id as string
  expect(runId).toContain("session-status")
  const shown = await ran(["runs", "show", runId, "--json"])
  expect(shown.code, shown.err).toBe(0)
  expect(JSON.parse(shown.out).item).toMatchObject({ command: "session status", status: "success", requests: 1 })
})

it("meetings sync asks Beeline inside its own recorded run", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  beeline(() => Response.json([record(1)]))
  const synced = await ran(["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z", "--record", "--json"])
  expect(synced.code, synced.err).toBe(0)
  const runId = JSON.parse(synced.out).meta.run_id as string
  expect(runId).toContain("meetings-sync")
  const shown = await ran(["runs", "show", runId, "--json"])
  expect(shown.code, shown.err).toBe(0)
  expect(JSON.parse(shown.out).item).toMatchObject({ command: "meetings sync", status: "success", requests: 1 })
})

it("session list shows each profile here and whether it is signed in, without the token", async () => {
  const keyring = memoryKeyring()
  beeline(() => Response.json([]))
  const started = await ran(["work", "session", "start", "--json"], { keyring, stdin: Readable.from(["secret-1\n"]) })
  expect(started.code, started.err).toBe(0)

  const listed = await ran(["session", "list", "--json"], { keyring })
  expect(listed.code, listed.err).toBe(0)
  expect(JSON.parse(listed.out).items).toContainEqual({ profile: "work", signed_in: true, token_from: "keyring" })
  expect(listed.out).not.toContain("secret-1")
  await ran(["work", "session", "end", "--json"], { keyring })
})

it("stores the same call times whatever the machine's zone (WC-TIME-6)", async () => {
  const zone = process.env.TZ
  process.env.BEELINE_TOKEN = "test-token"
  beeline(() => Response.json([record(41), record(42, { direction: "INBOUND" })]))
  const storedUnder = async (tz: string) => {
    process.env.TZ = tz
    expect((await ran(["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z"])).code).toBe(0)
    const listed = await ran(["work", "meetings", "list", "started_at:[2026-10-20 TO 2026-10-21]", "--json"])
    return JSON.parse(listed.out).items.map(({ started_at, ended_at, duration_ms }: Record<string, unknown>) => ({
      started_at,
      ended_at,
      duration_ms,
    }))
  }
  try {
    const east = await storedUnder("Asia/Vladivostok")
    const west = await storedUnder("America/Los_Angeles")
    expect(east.length).toBeGreaterThan(0)
    expect(west).toEqual(east)
  } finally {
    if (zone === undefined) delete process.env.TZ
    else process.env.TZ = zone
  }
})

it("keeps beeline's own reasons in the error a caller branches on", async () => {
  const unsigned = await ran(["work", "meetings", "sync", "--json"], { keyring: memoryKeyring() })
  expect(JSON.parse(unsigned.err).error).toMatchObject({
    code: "authentication_error",
    reason: "profile.not-signed-in",
  })

  process.env.BEELINE_TOKEN = "test-token"
  beeline(() => new Response("{}", { status: 403 }))
  const refused = await ran(["work", "meetings", "sync", "--json"])
  expect(JSON.parse(refused.err).error).toMatchObject({ code: "authentication_error", reason: "token.refused" })

  beeline(() => Response.json({ errorCode: "UserNotFound" }, { status: 400 }))
  const failed = await ran(["work", "meetings", "sync", "--json"])
  const error = JSON.parse(failed.err).error
  expect(error.message).toContain("UserNotFound")
  expect(error.details?.provider_error ?? error.provider_error).toBe("UserNotFound")
  expect(error.reason).not.toMatch(/^beeline\./)
})

it("session start refuses a profile named after a command before it asks for a token", async () => {
  process.env.BEELINE_PROFILE = "meetings"
  const fetch = beeline(() => Response.json([]))
  const refused = await ran(["session", "start", "--json"], { keyring: memoryKeyring(), stdin: Readable.from(["x\n"]) })
  delete process.env.BEELINE_PROFILE
  expect(refused.code).toBe(2)
  expect(fetch).not.toHaveBeenCalled()
})

it("reads the calls an earlier sync stored without writing to the store", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  beeline(() => Response.json([record(7)]))
  expect((await ran(["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z"])).code).toBe(0)
  const files = [storePath(process.env), `${storePath(process.env)}-wal`].filter((file) => existsSync(file))
  const before = files.map((file) => [statSync(file).mtimeMs, statSync(file).size])

  process.env.BEELINE_READ_ONLY = "1"
  const listed = await ran(["work", "meetings", "list", "--json"])
  delete process.env.BEELINE_READ_ONLY
  expect(listed.code, listed.err).toBe(0)
  expect(JSON.parse(listed.out).items.length).toBeGreaterThan(0)
  expect(files.map((file) => [statSync(file).mtimeMs, statSync(file).size])).toEqual(before)
})

it("a first read of a profile that never synced answers an empty list", async () => {
  const listed = await ran(["fresh", "meetings", "list", "--json"])
  expect(listed.code, listed.err).toBe(0)
  expect(JSON.parse(listed.out).items).toEqual([])
})
