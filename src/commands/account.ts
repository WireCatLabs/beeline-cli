import { annotate } from "@wirecat/cli-base/commands"
import {
  type AccountRemoval,
  accountRemoveCommand,
  LOCAL_READ,
  LOCAL_WRITE,
  ProfileTokenStore,
} from "@wirecat/cli-core/cli"
import { Command } from "commander"
import { PROVIDER_NAME } from "../call-source.js"
import { configuration } from "../config.js"
import { IDENTITY } from "../identity.js"

const removal: AccountRemoval = {
  // Beeline's API cannot revoke a token; only the Beeline cabinet deletes it.
  signOut: async (profile, { env, keyring }) => {
    new ProfileTokenStore({ app: IDENTITY, env, ...(keyring ? { keyring } : {}) }).remove(profile)
    return { revoked: null, removed: [`the Beeline API token of ${profile} (the token itself stays valid in Beeline)`] }
  },
}

export const accountCommand = (): Command =>
  annotate(new Command("account"), { effects: LOCAL_READ })
    .description("this profile on this computer")
    .addCommand(
      annotate(
        accountRemoveCommand(IDENTITY, removal, {
          provider: PROVIDER_NAME,
          resolveSettings: configuration.resolveSettings,
        }),
        { effects: LOCAL_WRITE },
      ),
    )
