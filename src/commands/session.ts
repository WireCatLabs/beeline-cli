import { CliError } from "@wirecat/cli-base"
import { annotate } from "@wirecat/cli-base/commands"
import { readSecret } from "@wirecat/cli-core"
import {
  baseContext,
  commandWords,
  environmentOf,
  FETCH,
  itemOf,
  LOCAL_READ,
  LOCAL_WRITE,
  listOf,
  logsInOrOut,
  outputFor,
  profileFree,
  profilesHere,
  REMOTE_READ,
  refuseCommandName,
  refuseUnderReadOnly,
  rememberAccount,
  renderAnswer,
  rootOf,
  secretInputOf,
} from "@wirecat/cli-core/cli"
import { Command } from "commander"
import { beelineFor, refuseOffline } from "../beeline.js"
import { configuration } from "../config.js"
import { IDENTITY } from "../identity.js"
import { TOKEN_VARIABLE, tokens } from "../token.js"

const contextOf = (command: Command) => {
  const { settings, env, keyring, run } = baseContext(command, configuration.resolveSettings)
  return { profile: settings.profile, env, offline: settings.offline, tokens: tokens(env, keyring), run }
}

const answer = (command: Command, item: unknown) => renderAnswer(command, outputFor(command), itemOf(item))

const startCommand = () =>
  logsInOrOut(
    annotate(new Command("start"), {
      effects: FETCH,
      lifetime: "interactive",
      mcp: false,
      examples: [`${IDENTITY.command} work session start`],
    }),
  )
    .summary("sign in with the Beeline API token")
    .description(
      "sign this profile in: the API token (Beeline cabinet → Услуги → Интеграция по API) is asked hidden or read " +
        "from stdin, checked against Beeline, and only then kept in the keyring, or in a private file when the keyring " +
        "fails",
    )
    .option(
      "--credential-storage <storage>",
      "where the token is kept: keyring (the default, which falls back to a private file by itself when no " +
        "keyring works), or file, not recommended",
      "keyring",
    )
    .action(async function (this: Command, args: { credentialStorage: string }) {
      const storage = args.credentialStorage
      if (storage !== "keyring" && storage !== "file")
        throw new CliError("validation_error", "--credential-storage takes keyring or file")
      const { profile, env, offline, tokens, run } = contextOf(this)
      refuseCommandName(profile, commandWords(rootOf(this)), IDENTITY.command)
      refuseOffline(offline)
      const token = (await readSecret("Beeline API token: ", secretInputOf(this))).trim()
      if (!token) throw new CliError("validation_error", "no token was given")
      await run(() => beelineFor(this, token).records())
      const storedIn = tokens.write(profile, token, storage)
      // Beeline names no user behind a token; the store keys the account by the profile, so this does too.
      rememberAccount(IDENTITY, profile, profile, env)
      answer(this, { profile, state: "saved", stored_in: storedIn, verified: true })
    })

const statusCommand = () =>
  annotate(new Command("status"), {
    effects: REMOTE_READ,
    examples: [`${IDENTITY.command} work session status`, `${IDENTITY.command} work session status --check --json`],
  })
    .summary("show where this profile's token comes from; never the token")
    .description(
      `show where this profile's token comes from: ${TOKEN_VARIABLE}, the keyring or a file; never the token`,
    )
    .option("--check", "ask Beeline to prove the token still works")
    .action(async function (this: Command, args: { check?: boolean }) {
      const { profile, offline, tokens, run } = contextOf(this)
      if (args.check) refuseOffline(offline)
      const stored = tokens.read(profile)
      const status = {
        profile,
        state: stored ? "saved" : "missing",
        token_from: stored?.source ?? null,
        verified: false,
      }
      if (!args.check || !stored) return answer(this, status)
      await run(() => beelineFor(this, stored.secret).records())
      answer(this, { ...status, verified: true })
    })

const endCommand = () =>
  logsInOrOut(
    annotate(new Command("end"), {
      effects: LOCAL_WRITE,
      mcp: false,
      examples: [`${IDENTITY.command} work session end`],
    }),
  )
    .description("forget this profile's token on this computer; synced calls stay")
    .action(function (this: Command) {
      refuseUnderReadOnly(this, "session end")
      const { profile, tokens } = contextOf(this)
      answer(this, { profile, ended: tokens.remove(profile), calls: "retained" })
    })

const listCommand = () =>
  profileFree(
    annotate(new Command("list"), {
      effects: LOCAL_READ,
      examples: [`${IDENTITY.command} session list`, `${IDENTITY.command} session list --json`],
    }),
  )
    .summary("list the profiles here and whether each is signed in")
    .description("list the profiles on this computer and whether each has a Beeline token; picks none")
    .action(function (this: Command) {
      const environment = environmentOf(this)
      const env = environment.env ?? process.env
      // biome-ignore lint/plugin/no-own-settings: baseContext needs a profile, and this local read names none
      const { configuredProfiles } = configuration.resolveSettings({}, { env, needsProfile: false })
      const store = tokens(env, environment.keyring)
      const items = profilesHere(IDENTITY, configuredProfiles, env).map((profile) => {
        try {
          const stored = store.read(profile)
          return { profile, signed_in: stored !== undefined, token_from: stored?.source ?? null }
        } catch (error) {
          // A locked keyring must not hide the other profiles.
          if (!(error instanceof CliError)) throw error
          return { profile, signed_in: null, token_from: null, error: error.message }
        }
      })
      renderAnswer(
        this,
        outputFor(this),
        listOf("session list", { items, limit: Math.max(1, items.length), has_more: false }),
      )
    })

export const sessionCommand = (): Command =>
  annotate(new Command("session"), { effects: LOCAL_READ })
    .description("keep this profile's Beeline API token in the OS keyring")
    .addCommand(startCommand())
    .addCommand(statusCommand())
    .addCommand(endCommand())
    .addCommand(listCommand())
