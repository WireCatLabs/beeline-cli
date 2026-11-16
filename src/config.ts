import { type Configuration, commandPermissions, plain, settingsFor } from "@wirecat/cli-core/cli"
import * as v from "valibot"
import { IDENTITY } from "./identity.js"
import { KEEP_RECORDINGS } from "./recordings.js"

/** Each command is checked against its own path (`notes.list`); add the keys a command checks inside itself. */
export const permissions = commandPermissions()

export const configuration: Configuration = settingsFor(IDENTITY, {
  permissions,
  profile: { [KEEP_RECORDINGS]: v.optional(v.boolean(plain("has to be true or false"))) },
  settings: [
    {
      key: KEEP_RECORDINGS,
      default: true,
      description:
        "keep each call's recording on this computer after meetings transcribe, so WireCat Desktop plays it; " +
        "false drops it once transcribed",
    },
  ],
})
