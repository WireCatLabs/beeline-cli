import { realpathSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { pathToFileURL } from "node:url"

// The previous release writes the state with its own modules and its own cli-core: a sync of fake call records, as
// `beeline meetings sync` makes one, so the candidate reopens the schema, rows and cursor that release left. No token:
// the runner denies the keyring and the network. The clients are extensions: an E.164 number trips its phone scan.
const entry = realpathSync(process.argv[2])
const fromPrevious = createRequire(entry)
const previous = (path) => import(pathToFileURL(join(dirname(entry), "..", path)).href)
// cli-core 2.x names an entry per area; 3.x serves them all from ".", so a previous release on either one loads.
const core = async (name) => {
  try {
    return await import(pathToFileURL(fromPrevious.resolve(`@wirecat/cli-core/${name}`)).href)
  } catch (error) {
    if (error?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error
    return import(pathToFileURL(fromPrevious.resolve("@wirecat/cli-core")).href)
  }
}

if (!process.env.WIRECAT_CONTRACT_DENIED) throw new Error("requires the isolated contract runner")

const [{ openProfileStore }, { callSource }, { pull }] = await Promise.all([
  previous("store.js"),
  previous("call-source.js"),
  core("meetings"),
])

const now = Date.parse("2026-10-21T10:00:00Z")
const call = (id, phone) => ({
  id: String(id),
  externalId: `ext-${id}`,
  phone,
  direction: "INBOUND",
  date: Date.parse("2026-10-20T10:00:00Z") + id * 60_000,
  duration: 50_140,
  fileSize: 201_024,
  abonent: {
    userId: "70000000001@example.test",
    phone: "70000000001",
    firstName: "wirecat-synthetic-manager-canary",
    lastName: "Example",
  },
})
const api = {
  allRecords: async function* () {
    yield call(1, "5678")
    yield call(2, "1234")
  },
}

const { store, accountId } = await openProfileStore(process.env, "contract", false)
try {
  const report = await pull(
    callSource(() => api),
    store.meetings,
    { accountId, now },
  )
  if (report.meetings !== 2 || report.warnings.length > 0)
    throw new Error(`the previous release's sync did not complete: ${JSON.stringify(report)}`)
} finally {
  await store.close()
}
process.stdout.write(`${JSON.stringify({ seeded: true })}\n`)
