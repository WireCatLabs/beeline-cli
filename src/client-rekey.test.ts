import { DatabaseSync } from "node:sqlite"
import { storePath } from "@wirecat/cli-core"
import { afterEach, expect, it } from "vitest"
import { run } from "./program.js"
import { oldClientRekeys, openBeelineStore, rekeyOldClients } from "./store.js"
import { strictBeeline } from "./testing/fake-beeline.js"
import { record } from "./testing/records.js"

const ran = async (argv: string[], fetch: (url: URL) => Promise<Response>) => {
  const out: string[] = []
  const err: string[] = []
  const code = await run(argv, {
    streams: { data: (text) => out.push(text), diagnostic: (text) => err.push(text) },
    tty: false,
    fetch: strictBeeline(fetch),
  })
  return { code, out: out.join("\n"), err: err.join("\n") }
}

const sync = (records: ReturnType<typeof record>[]) =>
  ran(["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z", "--json"], async () =>
    Response.json(records),
  )

const sql = <T>(work: (db: DatabaseSync) => T): T => {
  const db = new DatabaseSync(storePath(process.env))
  try {
    return work(db)
  } finally {
    db.close()
  }
}

const clientIds = () =>
  sql((db) =>
    db
      .prepare(
        `SELECT external_id AS id, phone FROM identities
         WHERE provider = 'beeline' AND (external_id LIKE 'phone:%' OR external_id LIKE 'number:%')`,
      )
      .all()
      .map((row) => ({ id: String(row.id), phone: row.phone })),
  )

const clientOfMeeting = (call: string) =>
  sql(
    (db) =>
      db
        .prepare(
          `SELECT i.external_id AS id FROM meeting_participants p JOIN identities i ON i.id = p.identity_id
           JOIN meetings m ON m.id = p.meeting_id WHERE m.external_id = ? AND p.role = 'client'`,
        )
        .get(call)?.id,
  )

afterEach(() => {
  delete process.env.BEELINE_TOKEN
})

it("names the current id of each old caller id and leaves the E.164 ones", () => {
  expect(
    oldClientRekeys([
      "phone:9000000009",
      "phone:+9000000009",
      "phone:+4950000001",
      "phone:+79000000009",
      "phone:+70000000005",
      "phone:1234",
      "phone:+0000000001",
      "number:1234",
      "abonent:70000000001@example.test",
    ]),
  ).toEqual([
    { from: "phone:9000000009", to: "phone:+79000000009", phone: "+79000000009" },
    { from: "phone:+9000000009", to: "phone:+79000000009", phone: "+79000000009" },
    { from: "phone:+4950000001", to: "phone:+74950000001", phone: "+74950000001" },
    { from: "phone:1234", to: "number:1234" },
    { from: "phone:+0000000001", to: "number:0000000001" },
  ])
})

it("a sync moves the callers an older build stored to their E.164 ids, merging into one already there", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  const first = await sync([
    record(701, { phone: "9000000001" }),
    record(702, { phone: "9000000002" }),
    record(703, { phone: "9000000003" }),
    record(704, { phone: "1234" }),
  ])
  expect(first.code, first.err).toBe(0)
  // As development builds of 0.1.0 wrote them; 703's client is 701's in the other old form.
  sql((db) => {
    const rename = db.prepare("UPDATE identities SET external_id = ?, phone = ? WHERE external_id = ?")
    rename.run("phone:9000000001", null, "phone:+79000000001")
    rename.run("phone:+9000000002", "+9000000002", "phone:+79000000002")
    rename.run("phone:+9000000001", "+9000000001", "phone:+79000000003")
  })
  expect(clientOfMeeting("703")).toBe("phone:+9000000001")

  const second = await sync([])
  expect(second.code, second.err).toBe(0)
  expect(second.err).toContain("moved old caller ids to their current ids: 2 renamed, 1 merged")
  expect(clientIds()).toEqual(
    expect.arrayContaining([
      { id: "phone:+79000000001", phone: "+79000000001" },
      { id: "phone:+79000000002", phone: "+79000000002" },
      { id: "number:1234", phone: null },
    ]),
  )
  expect(clientIds()).toHaveLength(3)
  expect(clientOfMeeting("701")).toBe("phone:+79000000001")
  expect(clientOfMeeting("703")).toBe("phone:+79000000001")

  const third = await sync([])
  expect(third.code, third.err).toBe(0)
  expect(third.err).not.toContain("moved old caller ids")
  const store = await openBeelineStore(process.env)
  try {
    expect(await rekeyOldClients(store)).toEqual({ renamed: 0, merged: 0, refused: 0 })
  } finally {
    await store.close()
  }
})

it("merges an old caller id into the E.164 id a newer sync already stored", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  expect((await sync([record(801, { phone: "9000000004" }), record(802, { phone: "9000000005" })])).code).toBe(0)
  sql((db) =>
    db
      .prepare("UPDATE identities SET external_id = ? WHERE external_id = ?")
      .run("phone:9000000004", "phone:+79000000005"),
  )

  const synced = await sync([])
  expect(synced.code, synced.err).toBe(0)
  expect(synced.err).toContain("0 renamed, 1 merged")
  expect(clientOfMeeting("802")).toBe("phone:+79000000004")
})

it("a sync moves an extension from its old phone: id to number:, merging into one already there", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  const first = await sync([
    record(1001, { phone: "1001" }),
    record(1002, { phone: "1002" }),
    record(1003, { phone: "1003" }),
    record(1004, { phone: "9000000007" }),
  ])
  expect(first.code, first.err).toBe(0)
  expect(clientOfMeeting("1001")).toBe("number:1001")
  // As 0.2.0 wrote them; 1003's client is 1002's number, which a newer sync already stored as number:1002.
  sql((db) => {
    const rename = db.prepare("UPDATE identities SET external_id = ? WHERE external_id = ?")
    rename.run("phone:1001", "number:1001")
    rename.run("phone:1002", "number:1003")
  })
  expect(clientOfMeeting("1003")).toBe("phone:1002")

  const second = await sync([])
  expect(second.code, second.err).toBe(0)
  expect(second.err).toContain("moved old caller ids to their current ids: 1 renamed, 1 merged")
  expect(clientIds()).toEqual(
    expect.arrayContaining([
      { id: "number:1001", phone: null },
      { id: "number:1002", phone: null },
      { id: "phone:+79000000007", phone: "+79000000007" },
    ]),
  )
  expect(clientIds().map(({ id }) => id)).not.toEqual(expect.arrayContaining(["phone:1001"]))
  expect(clientIds().map(({ id }) => id)).not.toEqual(expect.arrayContaining(["phone:1002"]))
  expect(clientOfMeeting("1001")).toBe("number:1001")
  expect(clientOfMeeting("1002")).toBe("number:1002")
  expect(clientOfMeeting("1003")).toBe("number:1002")
  expect(clientOfMeeting("1004")).toBe("phone:+79000000007")

  const third = await sync([])
  expect(third.code, third.err).toBe(0)
  expect(third.err).not.toContain("moved old caller ids")
})

it("a call synced again gets its direction, the client's number and a corrected title", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  const call = record(901, { phone: "9000000006", direction: "INBOUND" })
  expect((await sync([call])).code).toBe(0)
  // As an older build stored it: a `+` before the national number, no call fields.
  sql((db) =>
    db
      .prepare("UPDATE meetings SET title = ?, direction = NULL, client_phone = NULL WHERE external_id = '901'")
      .run("Входящий звонок · Test Manager ↔ +9000000006"),
  )
  expect((await sync([call])).code).toBe(0)
  const listed = await ran(["work", "meetings", "list", "--json"], async () => Response.json([]))
  const id = (JSON.parse(listed.out).items as { id: number; title: string }[]).find((one) =>
    one.title.endsWith("+79000000006"),
  )?.id
  const shown = await ran(["work", "meetings", "show", String(id), "--json"], async () => Response.json([]))
  expect(shown.code, shown.err).toBe(0)
  expect(JSON.parse(shown.out).item).toMatchObject({
    call: { direction: "in", client_phone: "+79000000006", manager: { name: "Test Manager" } },
  })
})
