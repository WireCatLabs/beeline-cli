import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { isCliError } from "@wirecat/cli-base"
import type { MessageStore } from "@wirecat/cli-core/store"
import type { IdentityRekey } from "@wirecat/cli-core/store/areas"
import { clientPhone, PROVIDER_NAME } from "./call-source.js"
import { IDENTITY } from "./identity.js"

export const PROVIDER = {
  name: PROVIDER_NAME,
  kind: "meetings",
  aliases: ["beeline-pbx"],
  command: IDENTITY.command,
} as const

/**
 * The shared store, with beeline's provider entry written, so every other CLI's search knows it (WC-ARCH-21). A
 * read-only open writes nothing, the entry included, and fails when the file is missing or needs a migration.
 */
export const openBeelineStore = async (env: NodeJS.ProcessEnv, { readOnly = false } = {}): Promise<MessageStore> => {
  const { ensureSqlite } = await import("@wirecat/cli-core/sqlite-runtime")
  await ensureSqlite()
  const { openStore, storePath } = await import("@wirecat/cli-core/store")
  const store = await openStore({
    path: storePath(env),
    env,
    command: IDENTITY.command,
    version: IDENTITY.version,
    ...(readOnly ? { readOnly } : {}),
  })
  try {
    if (!readOnly) await store.accounts.registerProvider(PROVIDER)
    return store
  } catch (error) {
    await store.close()
    throw error
  }
}

/**
 * A read finds the profile's account among the rows an earlier sync saved and writes nothing. A profile with no saved
 * account, or no store at all, reads an empty store in a temporary folder, so a mistyped profile saves no account and
 * creates no `wirecat.db`. A store that needs a migration is opened for writing to migrate it, unless
 * `BEELINE_READ_ONLY` is set. Only a command that `saves` (a sync, a transcription) saves the profile's account.
 */
export const openProfileStore = async (
  env: NodeJS.ProcessEnv,
  profile: string,
  reads: boolean,
  saves = !reads,
): Promise<{ store: MessageStore; accountId: number }> => {
  if (saves) return openWritable(env, profile)
  if (!reads) return openKnown(await openBeelineStore(env), env, profile)
  const { readOnlyLockOf } = await import("@wirecat/cli-core/cli")
  const locked = readOnlyLockOf(IDENTITY, env) !== undefined
  let store: MessageStore
  try {
    store = await openBeelineStore(env, { readOnly: true })
  } catch (error) {
    if (isCliError(error) && error.code === "not_found") return openEmptyStore(env, profile)
    if (locked) throw error
    store = await openBeelineStore(env)
  }
  return openKnown(store, env, profile)
}

const openKnown = async (store: MessageStore, env: NodeJS.ProcessEnv, profile: string) => {
  const saved = await store.accounts.storedAccount({ provider: PROVIDER.name, account: profile }).catch(() => undefined)
  if (saved) return { store, accountId: saved.id }
  await store.close()
  return openEmptyStore(env, profile)
}

const openWritable = async (env: NodeJS.ProcessEnv, profile: string) => {
  const store = await openBeelineStore(env)
  const closing = (error: unknown) => store.close().then(() => Promise.reject(error))
  const key = { provider: PROVIDER.name, account: profile }
  // Calls are the company's: work scope, so a work search (b24's `search all`) includes them. An account already stored
  // keeps the scope the owner gave it.
  return { store, accountId: await store.accounts.saveAccount(key, { name: profile, scope: "work" }).catch(closing) }
}

const openEmptyStore = async (env: NodeJS.ProcessEnv, profile: string) => {
  const folder = mkdtempSync(join(tmpdir(), "beeline-empty-"))
  const removing = () => rmSync(folder, { recursive: true, force: true })
  try {
    const { store, accountId } = await openWritable({ ...env, MESSAGING_STORE: join(folder, "wirecat.db") }, profile)
    const close = store.close.bind(store)
    store.close = () => close().finally(removing)
    return { store, accountId }
  } catch (error) {
    removing()
    throw error
  }
}

/**
 * A caller's id as an older build wrote it, moved to the id it gets now. Development builds of 0.1.0 first wrote the
 * 10-digit national number Beeline sends (`phone:9000000009`); then, for a day, that number behind a `+`
 * (`phone:+9000000009`). Those move to `phone:+7…`. A number `clientPhone` cannot read, such as an extension, was
 * `phone:<raw>` up to 0.2.0 and moves to `number:<raw>`. An E.164 id stays.
 */
export const oldClientRekeys = (ids: readonly string[]): IdentityRekey[] =>
  ids.flatMap((from): IdentityRekey[] => {
    const digits = /^phone:(?:\+(?=\d{10}$))?(\d+)$/.exec(from)?.[1]
    const phone = digits === undefined ? undefined : clientPhone(digits)
    if (phone) return `phone:${phone}` === from ? [] : [{ from, to: `phone:${phone}`, phone }]
    if (!from.startsWith("phone:") || /^phone:\+[1-9]\d{6,14}$/.test(from)) return []
    return [{ from, to: `number:${digits ?? from.slice("phone:".length)}` }]
  })

export interface ClientRekeys {
  renamed: number
  merged: number
  refused: number
}

/** Moves every profile's old caller ids to their current ids in passes short enough for other commands to get the write lock. */
export const rekeyOldClients = async (store: MessageStore): Promise<ClientRekeys> => {
  const ids = (await store.people.people(PROVIDER_NAME)).all().map((one) => String(one.id))
  let rest = oldClientRekeys(ids)
  const total = { renamed: 0, merged: 0, refused: 0 }
  while (rest.length > 0) {
    const pass = await store.people.rekeyIdentities(PROVIDER_NAME, rest, { by: IDENTITY.command })
    total.renamed += pass.renamed
    total.merged += pass.merged
    total.refused += pass.refused.length
    if (pass.taken === 0) break
    rest = rest.slice(pass.taken)
  }
  return total
}
