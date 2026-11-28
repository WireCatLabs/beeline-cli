import type { IdentityRekey, MessageStore } from "@wirecat/cli-core"
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
  const { openAppStore } = await import("@wirecat/cli-core")
  return openAppStore(env, { app: IDENTITY, provider: PROVIDER, readOnly })
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
