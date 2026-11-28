import { CliError, isCliError, type SleepLike } from "@wirecat/cli-base"
import type { FetchLike } from "@wirecat/cli-base/http"
import { type BaseEnvironment, environmentOf } from "@wirecat/cli-core"
import type { Command } from "commander"
import { type BeelineApi, beelineApi } from "./beeline-api.js"
import { IDENTITY } from "./identity.js"

export type { BeelineApi } from "./beeline-api.js"

/** What a test hands `run()` in place of the network and real waiting. */
export interface BeelineEnvironment extends BaseEnvironment {
  fetch?: FetchLike
  sleep?: SleepLike
}

/** The transport names no command; here a refused token gets the one that sets a new one. */
const withNextStep = (profile: string) => (error: unknown) => {
  if (!isCliError(error) || error.details.reason !== "token.refused") throw error
  throw new CliError(
    error.code,
    `${error.message}; set a new one with \`${IDENTITY.command} ${profile} session start\``,
    error.details,
  )
}

/** Beeline's API for one command, with the run's signal, and the fetch and sleep its environment gives. */
export const beelineFor = (command: Command, token: string, profile: string): BeelineApi => {
  const { fetch, sleep, signal } = environmentOf<BeelineEnvironment>(command)
  const api = beelineApi(token, {
    ...(fetch ? { fetch } : {}),
    ...(sleep ? { wait: sleep } : {}),
    ...(signal ? { signal } : {}),
  })
  const refused = withNextStep(profile)
  return {
    records: (query) => api.records(query).catch(refused),
    recording: (id) => api.recording(id).catch(refused),
    async *allRecords(query) {
      try {
        yield* api.allRecords(query)
      } catch (error) {
        refused(error)
      }
    },
  }
}
