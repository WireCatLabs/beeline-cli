import { type CredentialSource, Credentials, isMovedRun, type KeyringStore, resolvePaths } from "@wirecat/cli-base"
import { IDENTITY } from "./identity.js"

export const TOKEN_VARIABLE = `${IDENTITY.envPrefix}_TOKEN`

/**
 * The API token, as WC-SECR-4 orders it: `BEELINE_TOKEN`, then the keyring entry `token:<profile>`, then a 0600 file.
 * cli-base reads a token in the file first, so it never waits on a locked keyring.
 */
export const tokens = (env: NodeJS.ProcessEnv, keyring?: KeyringStore) => {
  const where = { appName: IDENTITY.appName, prefix: IDENTITY.envPrefix, env }
  const options = {
    configDir: resolvePaths(where).config,
    service: IDENTITY.appName,
    envVar: TOKEN_VARIABLE,
    isolated: isMovedRun(where),
    env,
    ...(keyring ? { keyring } : {}),
    warn: (message: string) => process.stderr.write(`${message}\n`),
  }
  const credentials = new Credentials(options)
  const account = (profile: string) => `token:${profile}`
  const forgetKeyringCopy = (profile: string) => {
    try {
      new Credentials({ ...options, storage: "keyring" }).remove(account(profile))
    } catch {
      // No keyring on this computer: there is no copy to forget.
    }
  }
  return {
    read: (profile: string) => credentials.read(account(profile)),
    write: (profile: string, token: string, storage: "keyring" | "file" = "keyring"): CredentialSource => {
      if (storage === "keyring") return credentials.write(account(profile), token, { signIn: true })
      const kept = new Credentials({ ...options, storage: "file" }).write(account(profile), token)
      forgetKeyringCopy(profile)
      return kept
    },
    remove: (profile: string): CredentialSource[] => credentials.remove(account(profile)),
  }
}
