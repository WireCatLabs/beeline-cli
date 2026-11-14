import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"
import { memoryKeyring } from "@wirecat/cli-base"
import type { FetchLike } from "@wirecat/cli-base/http"
import { storePath } from "@wirecat/cli-core/store"
import { afterEach, expect, it, vi } from "vitest"
import { clientPhone } from "./call-source.js"
import { run } from "./program.js"
import { openBeelineStore } from "./store.js"
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
  expect(JSON.parse(listed.out).page).toMatchObject({ limit: 20 })
  expect(JSON.parse(listed.out).items.map((one: { title: string }) => one.title)).toContain(
    "Входящий звонок · Test Manager ↔ +79000000000",
  )
  const inbound = JSON.parse((await ran(["work", "meetings", "list", "title:Входящий*", "--json"])).out).items
  expect(inbound).toHaveLength(1)

  const store = await openBeelineStore(process.env, { readOnly: true })
  try {
    expect(await store.accounts.storedAccount({ provider: "beeline", account: "work" })).toMatchObject({
      scope: "work",
    })
  } finally {
    await store.close()
  }

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

it("keeps the reasons a caller branches on in the error", async () => {
  const unsigned = await ran(["work", "meetings", "sync", "--json"], { keyring: memoryKeyring() })
  expect(JSON.parse(unsigned.err).error).toMatchObject({
    code: "authentication_error",
    reason: "session.missing",
    message: expect.stringContaining("beeline work session start"),
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

it("under the read-only lock a read on a new machine answers empty and creates no store; a sync still writes", async () => {
  const store = join(mkdtempSync(join(tmpdir(), "new-machine-")), "wirecat.db")
  vi.stubEnv("MESSAGING_STORE", store)
  vi.stubEnv("BEELINE_READ_ONLY", "1")
  vi.stubEnv("BEELINE_TOKEN", "test-token")
  try {
    const listed = await ran(["fresh", "meetings", "list", "--json"])
    expect(listed.code, listed.err).toBe(0)
    expect(JSON.parse(listed.out).items).toEqual([])
    expect(existsSync(store)).toBe(false)

    beeline(() => Response.json([record(81)]))
    expect((await ran(["fresh", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z"])).code).toBe(0)
    expect(JSON.parse((await ran(["fresh", "meetings", "list", "--json"])).out).items).toHaveLength(1)
  } finally {
    vi.unstubAllEnvs()
  }
})

it("a sync stopped by its budget keeps what it saved, says how to go on, and the next one picks up the rest", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  const calls = [record(51), record(52), record(53)]
  beeline(() => Response.json(calls))
  // Eight seconds less cli-core's five-second margin leave room for one meeting at its two seconds a request.
  const argv = ["partial", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z", "--timeout", "8s", "--json"]
  const stopped = await ran(argv)
  expect(stopped.code, stopped.err).toBe(0)
  const answer = JSON.parse(stopped.out)
  expect(answer.item).toMatchObject({ meetings: 1, stopped: "requests", remaining: 2 })
  expect(answer.meta.complete).toBe(false)
  expect(answer.next[0]).toMatchObject({ command: "meetings sync", safe_to_auto_execute: true })

  const fetch = beeline(() => Response.json(calls))
  const resumed = await ran(["partial", "meetings", "sync", "--json"])
  expect(resumed.code, resumed.err).toBe(0)
  expect(JSON.parse(resumed.out).item).not.toHaveProperty("stopped")
  const asked = new URL(fetch.mock.calls[0]?.[0] as string)
  expect(asked.searchParams.get("dateFrom")).toBe(new Date(record(52).date - 3 * 3_600_000).toISOString())
  const listed = JSON.parse((await ran(["partial", "meetings", "list", "--json"])).out).items
  expect(listed).toHaveLength(3)
})

it("--lookback-days widens the three-hour overlap instead of adding to it", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  const fetch = beeline(() => Response.json([]))
  const since = "2026-10-10T00:00:00.000Z"
  expect((await ran(["lookback", "meetings", "sync", "--since-time", since, "--lookback-days", "1"])).code).toBe(0)
  const asked = new URL(fetch.mock.calls[0]?.[0] as string)
  expect(asked.searchParams.get("dateFrom")).toBe(new Date(Date.parse(since) - 86_400_000).toISOString())
})

it("--rescan reads the last 30 days and the overlap again, whatever the cursor says", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  vi.useFakeTimers({ toFake: ["Date"] })
  const now = Date.UTC(2026, 10, 1)
  vi.setSystemTime(now)
  const fetch = beeline(() => Response.json([]))
  expect((await ran(["rescan", "meetings", "sync"])).code).toBe(0)
  expect((await ran(["rescan", "meetings", "sync", "--rescan"])).code).toBe(0)
  vi.useRealTimers()
  const asked = new URL(fetch.mock.calls[1]?.[0] as string)
  expect(asked.searchParams.get("dateFrom")).toBe(new Date(now - 30 * 86_400_000 - 3 * 3_600_000).toISOString())
})

it("meetings export prints under the read-only lock and writes a file only in the run work folder", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  beeline(() => Response.json([record(61)]))
  expect((await ran(["export", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z"])).code).toBe(0)
  const id = String(JSON.parse((await ran(["export", "meetings", "list", "--json"])).out).items[0].id)
  const files = [storePath(process.env), `${storePath(process.env)}-wal`].filter((file) => existsSync(file))
  const before = files.map((file) => [statSync(file).mtimeMs, statSync(file).size])

  const work = mkdtempSync(join(tmpdir(), "beeline-work-"))
  process.env.BEELINE_READ_ONLY = "1"
  process.env.BEELINE_WORK_FOLDER = work
  const printed = await ran(["export", "meetings", "export", id, "--json"])
  const outside = await ran(["export", "meetings", "export", id, "--output", join(tmpdir(), "outside.md"), "--json"])
  const output = join(work, "call.md")
  const lockedWrite = await ran(["export", "meetings", "export", id, "--output", output, "--json"])
  delete process.env.BEELINE_READ_ONLY
  delete process.env.BEELINE_WORK_FOLDER
  expect(printed.code, printed.err).toBe(0)
  expect(JSON.parse(printed.out).item.content).toContain("#")
  expect(JSON.parse(outside.err).error.reason).toBe("read-only.output-outside")
  expect(lockedWrite.code, lockedWrite.err).toBe(0)
  expect(files.map((file) => [statSync(file).mtimeMs, statSync(file).size])).toEqual(before)
  expect(statSync(output).mode & 0o777).toBe(0o600)

  const taken = join(tmpdir(), "taken.md")
  writeFileSync(taken, "kept")
  const refused = await ran(["export", "meetings", "export", id, "--output", taken, "--json"])
  expect(JSON.parse(refused.err).error.code).toBe("validation_error")
  expect(readFileSync(taken, "utf8")).toBe("kept")
})

it("account remove forgets the token and keeps or deletes the profile's calls", async () => {
  const keyring = memoryKeyring()
  beeline(() => Response.json([record(61)]))
  const signIn = () => ran(["work", "session", "start", "--json"], { keyring, stdin: Readable.from(["right\n"]) })
  const calls = async () => JSON.parse((await ran(["work", "meetings", "list", "--json"])).out).items.length
  expect((await signIn()).code).toBe(0)
  expect((await ran(["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z"], { keyring })).code).toBe(0)
  const synced = await calls()

  const dry = await ran(["work", "account", "remove", "--delete-data", "--dry-run", "--json"], { keyring })
  expect(dry.code, dry.err).toBe(0)
  expect(JSON.parse(dry.out).item.removed).toContainEqual({ kind: "keyring", target: "token:work" })
  expect(keyring.get("beeline-cli", "token:work")).toBe("right")
  expect(await calls()).toBe(synced)

  const kept = await ran(["work", "account", "remove", "--keep-data", "--yes", "--json"], { keyring })
  expect(kept.code, kept.err).toBe(0)
  expect(JSON.parse(kept.out).item).toMatchObject({ data: "kept", revoked: null })
  expect(keyring.get("beeline-cli", "token:work")).toBeNull()
  expect(await calls()).toBe(synced)

  expect((await signIn()).code).toBe(0)
  const deleted = await ran(["work", "account", "remove", "--delete-data", "--yes", "--json"], { keyring })
  expect(deleted.code, deleted.err).toBe(0)
  expect(keyring.get("beeline-cli", "token:work")).toBeNull()
  expect(await calls()).toBeLessThan(synced)
})

it("a call with no transcript says so and how to make one, also for a call too short to be picked", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  beeline(() => Response.json([record(901, { duration: 10_000 }), record(902, { duration: 3_000 })]))
  expect((await ran(["plain", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z"])).code).toBe(0)
  const listed = JSON.parse((await ran(["plain", "meetings", "list", "--json"])).out).items as {
    id: string
    duration_ms: number
  }[]
  const long = listed.find((one) => one.duration_ms >= 5_000)?.id
  const short = listed.find((one) => one.duration_ms < 5_000)?.id
  const none = await ran(["plain", "meetings", "transcript", String(long), "--json"])
  expect(JSON.parse(none.err).error).toMatchObject({ code: "not_found", reason: "transcript.missing" })
  expect(JSON.parse(none.err).error.message).toContain(`beeline plain meetings transcribe id:${long}`)
  expect((await ran(["plain", "meetings", "transcript", String(long)])).err).toContain("has no transcript yet")
  const tooShort = await ran(["plain", "meetings", "transcript", String(short), "--json"])
  expect(JSON.parse(tooShort.err).error.reason).toBe("transcript.too-short")
  const vtt = await ran(["plain", "meetings", "export", String(long), "--format", "vtt", "--json"])
  expect(JSON.parse(vtt.err).error.reason).toBe("transcript.missing")
})

const crmContact = async (externalId: string, name: string, phone: string) => {
  const store = await openBeelineStore(process.env)
  try {
    const crm = { provider: "bitrix24", account: "work" }
    await store.accounts.registerProvider({ name: "bitrix24", kind: "crm", aliases: [], command: "b24" })
    await store.accounts.saveAccount(crm, { name: "work", scope: "work" })
    await store.crm.savePeople(crm, [{ externalId, name, phone }])
  } finally {
    await store.close()
  }
}

const clientOf = async (number: string) => {
  const listed = JSON.parse((await ran(["work", "meetings", "list", "--json"])).out).items as {
    id: number
    title: string
  }[]
  const call = listed.find((one) => one.title.endsWith(number))
  const shown = await ran(["work", "meetings", "show", String(call?.id), "--json"])
  expect(shown.code, shown.err).toBe(0)
  const { participants } = JSON.parse(shown.out).item.item as { participants: { role: string; person: unknown }[] }
  return participants.find((one) => one.role === "client")
}

it("a sync links a call to the b24 contact with the same mobile number", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  await crmContact("501", "Client Mobile", "8 (900) 000-00-01")
  beeline(() => Response.json([record(501, { phone: "9000000001" })]))

  const synced = await ran(["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z", "--json"])
  expect(synced.code, synced.err).toBe(0)

  expect(await clientOf("+79000000001")).toMatchObject({ person: { name: "Client Mobile" } })
})

it("a call from a landline only proposes the b24 contact with that number", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  await crmContact("502", "Office Landline", "8 (495) 000-00-01")
  beeline(() => Response.json([record(502, { phone: "4950000001" })]))

  const synced = await ran(["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z", "--json"])
  expect(synced.code, synced.err).toBe(0)

  expect((await clientOf("+74950000001"))?.person).not.toMatchObject({ name: "Office Landline" })
  const store = await openBeelineStore(process.env, { readOnly: true })
  try {
    const { items } = await store.people.linkProposals({ limit: 10, offset: 0 })
    expect(items).toEqual([
      expect.objectContaining({ identity: "bitrix24:work/contact/502", with: "beeline:phone:+74950000001" }),
    ])
  } finally {
    await store.close()
  }
})

it("reads Beeline's 10-digit national number as Russian and leaves an extension or a foreign number alone", () => {
  for (const raw of ["9000000001", "79000000001", "89000000001", "+79000000001"])
    expect(clientPhone(raw)).toBe("+79000000001")
  expect(clientPhone("4950000001")).toBe("+74950000001")
  for (const raw of ["1234", "0000000000", "375000000000000"]) expect(clientPhone(raw)).toBeUndefined()
})
