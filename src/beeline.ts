import type { SleepLike } from "@wirecat/cli-base"
import type { FetchLike } from "@wirecat/cli-base/http"
import { type BaseEnvironment, environmentOf } from "@wirecat/cli-core/cli"
import type { Command } from "commander"
import { type BeelineApi, beelineApi } from "./beeline-api.js"

export type { BeelineApi } from "./beeline-api.js"

/** What a test hands `run()` in place of the network and real waiting. */
export interface BeelineEnvironment extends BaseEnvironment {
  fetch?: FetchLike
  sleep?: SleepLike
}

/** Beeline's API for one command, with the run's signal, and the fetch and sleep its environment gives. */
export const beelineFor = (command: Command, token: string): BeelineApi => {
  const { fetch, sleep, signal } = environmentOf<BeelineEnvironment>(command)
  return beelineApi(token, {
    ...(fetch ? { fetch } : {}),
    ...(sleep ? { wait: sleep } : {}),
    ...(signal ? { signal } : {}),
  })
}
