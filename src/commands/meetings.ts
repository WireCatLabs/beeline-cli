import { CliError } from "@wirecat/cli-base"
import { annotate, metaOf } from "@wirecat/cli-base/commands"
import {
  baseContext,
  environmentOf,
  fetchesOnly,
  hasSharedContract,
  inCommandRun,
  itemOf,
  listOf,
  NO_EFFECTS,
  outputFor,
  overrideSharedContract,
  ProfileTokenStore,
  type RunOptions,
  readOnlyLockOf,
  readsOverMcp,
  refuseOffline,
  renderAnswer,
  runBudgetOf,
  snakeKeys,
  writeNewFile,
  writesNewFileOnlyWith,
} from "@wirecat/cli-core/cli"
import { type MeetingSource, type MeetingStore, parseMeetingReference } from "@wirecat/cli-core/meetings"
import { addMeetingCommands, addMeetingSearchCommand, type MeetingCommandDeps } from "@wirecat/cli-core/meetings/cli"
import type { MessageStore } from "@wirecat/cli-core/store"
import { Command, type Command as CommandType, InvalidArgumentError } from "commander"
import type { BeelineApi } from "../beeline.js"
import { configuration } from "../config.js"
import { IDENTITY } from "../identity.js"
import { transcribeCommand } from "./transcribe.js"

interface Opened {
  store: MessageStore
  accountId: number
  profile: string
  indexes: boolean
  env: NodeJS.ProcessEnv
  api: () => BeelineApi
  source: () => MeetingSource
  close: () => Promise<void>
}

const leaves = (command: Command): Command[] => (command.commands.length ? command.commands.flatMap(leaves) : [command])
const pathOf = (command: Command): string[] =>
  command.parent?.parent ? [...pathOf(command.parent), command.name()] : [command.name()]
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const LIST_KEYS = new Set(["items", "page", "limit", "hasMore", "meta"])

const EXAMPLES: Record<string, string> = {
  "meetings list": "--limit 20",
  "meetings show": "1",
  "meetings transcript": "1",
  "meetings export": "1 --format markdown",
  "meetings people": '"Test Manager"',
  "meetings sync": "--since-time 2026-08-01T00:00:00Z",
  "meetings repair": "",
  "events list": "",
  "search meetings": '"доставка"',
}

const withExample = (leaf: Command) => {
  const path = pathOf(leaf).join(" ")
  const args = EXAMPLES[path]
  if (args === undefined) return
  const change = (one: Command) => {
    annotate(one, { examples: [[IDENTITY.command, "work", path, args, "--json"].filter(Boolean).join(" ")] })
  }
  if (hasSharedContract(leaf))
    overrideSharedContract(leaf, "beeline's examples name its profile and a call id.", change)
  else change(leaf)
}

/** The id `meetings list` shows, or its `ref`: `375` and `meeting:1/375` name the same call. */
const meetingId = (text: string): number => {
  if (/^[1-9]\d*$/.test(text) && Number.isSafeInteger(Number(text))) return Number(text)
  try {
    return parseMeetingReference(text).meetingId
  } catch {
    throw new InvalidArgumentError("expected a call id or the ref meetings list prints, such as 375 or meeting:1/375")
  }
}

// cli-core's own `meetings show` reads the id, the ref and the service's id (0.660.0).
const TAKES_A_MEETING = ["meetings transcript", "meetings export"]
const UNUSED = new Set(["summary", "import"])

const acceptRef = (leaf: CommandType) => {
  const [argument] = leaf.registeredArguments
  if (!argument || !TAKES_A_MEETING.includes(pathOf(leaf).join(" "))) return
  overrideSharedContract(leaf, "beeline takes the ref meetings list prints as well as the plain id.", () => {
    argument.description = "stored call id, or the ref meetings list prints (meeting:1/375)"
    argument.argParser(meetingId)
  })
}

/** A call with no current transcript, said plainly with the step that makes one; cli-core prints an empty list. */
const noTranscript = async (store: MeetingStore, id: number, profile: string): Promise<CliError | undefined> => {
  const details = await store.meeting(id)
  if (!details) return undefined
  if (details.transcripts.some((one) => one.transcript.supersededAt === null && one.transcript.deletedAt === null))
    return undefined
  const short = (details.meeting.durationMs ?? 0) < 5_000
  return new CliError(
    "not_found",
    short
      ? `call ${id} is shorter than five seconds, so meetings transcribe skips it; run \`${IDENTITY.command} ${profile} ` +
          `meetings transcribe id:${id}\` to transcribe it anyway`
      : `call ${id} has no transcript yet; run \`${IDENTITY.command} ${profile} meetings transcribe id:${id}\``,
    { reason: short ? "transcript.too-short" : "transcript.missing", meeting: id },
  )
}

const goOn = (command: string, step: string, why: string, safe: boolean) => ({
  meta: { complete: false },
  next: [{ kind: "command" as const, step, command, args: {}, why, safe_to_auto_execute: safe }],
})

/** cli-core's reads answer `{ items, page, limit, hasMore, meta? }` or one value; beeline prints both in its envelope. */
const bodyOf = (command: Command, value: unknown) => {
  // cli-core 0.498 writes `meetings list` as a finished list, its `page` an object with the next step.
  if (isRecord(value) && Array.isArray(value.items) && isRecord(value.page))
    return value as Parameters<typeof renderAnswer>[2]
  if (isRecord(value) && Array.isArray(value.items) && Object.keys(value).every((key) => LIST_KEYS.has(key))) {
    const { next, ...list } = listOf(pathOf(command).join(" "), {
      items: snakeKeys(value.items) as unknown[],
      limit: Math.max(1, typeof value.limit === "number" ? value.limit : value.items.length),
      has_more: value.hasMore === true,
      ...(isRecord(value.meta) ? { meta: snakeKeys(value.meta) as Parameters<typeof listOf>[1]["meta"] } : {}),
    })
    const kept = next?.filter((one) => one.step !== "page.next") ?? []
    return { ...list, ...(kept.length > 0 ? { next: kept } : {}) }
  }
  if (pathOf(command).join(" ") === "meetings sync" && isRecord(value) && value.stopped)
    return itemOf(
      snakeKeys(value),
      goOn("meetings sync", "sync.continue", `${value.remaining} calls were not reached before the run stopped`, true),
    )
  return itemOf(snakeKeys(value))
}

/** The shared `meetings` commands over Beeline's call records: one call is one meeting, for this profile only. */
export const meetingsMount = () => {
  const commands = new Set<Command>()
  let action: Command | undefined
  let opened: Opened | undefined
  const answers: (() => void)[] = []
  const need = (): Opened => {
    if (!opened) throw new CliError("configuration_error", "the call store is not open for this command")
    return opened
  }
  const deps: MeetingCommandDeps = {
    get store(): MeetingStore {
      return need().store.meetings
    },
    get accountId() {
      return need().accountId
    },
    get source() {
      return need().source()
    },
    inRun: inCommandRun,
    newFileOutput: writesNewFileOnlyWith,
    writeFile: writeNewFile,
    budgetOf: runBudgetOf,
    write: (value) => {
      const at = action
      if (!at) throw new CliError("configuration_error", "no command is running")
      const body = bodyOf(at, value)
      answers.push(() => renderAnswer(at, outputFor(at), body))
    },
  }
  return {
    commands: (): Command[] => {
      const holder = new Command(IDENTITY.command)
      addMeetingCommands(holder, deps)
      const meetings = holder.commands.find((group) => group.name() === "meetings")
      if (meetings)
        overrideSharedContract(meetings, "Beeline gives no summaries and no transcript files to import.", (group) => {
          const mounted = group.commands as Command[]
          for (const one of mounted.filter((leaf) => UNUSED.has(leaf.name()))) mounted.splice(mounted.indexOf(one), 1)
        })
      addMeetingSearchCommand(holder, {
        search: async (query, request) => {
          const { searchMeetingHits } = await import("@wirecat/cli-core/services")
          const { store, accountId, indexes } = need()
          return searchMeetingHits(store, query, { ...request, accountId }, { refreshIndex: indexes })
        },
        signal: () => (action ? environmentOf(action).signal : undefined),
        output: (body) => {
          const at = action
          if (!at) throw new CliError("configuration_error", "no command is running")
          answers.push(() => renderAnswer(at, outputFor(at), body as Parameters<typeof renderAnswer>[2]))
        },
      })
      meetings?.addCommand(
        transcribeCommand({
          store: () => need().store.meetings,
          accountId: () => need().accountId,
          api: () => need().api(),
          env: () => need().env,
          signal: () => (action ? environmentOf(action).signal : undefined),
          progress: (line) => (action ? environmentOf(action).streams?.diagnostic(line) : undefined),
          write: (report, command) => {
            const resume = report.stopped
              ? goOn(
                  "meetings transcribe",
                  "transcribe.continue",
                  `${report.remaining} calls still have no transcript`,
                  false,
                )
              : {}
            answers.push(() => renderAnswer(command, outputFor(command), itemOf(report, resume)))
          },
        }),
      )
      for (const group of holder.commands) {
        if (group.commands.length && !hasSharedContract(group)) annotate(group, { effects: NO_EFFECTS })
        for (const leaf of leaves(group)) {
          acceptRef(leaf)
          if (["meetings transcript", "meetings export"].includes(pathOf(leaf).join(" ")))
            leaf.hook("preAction", async (one) => {
              if (pathOf(one).join(" ") === "meetings export" && one.opts().format !== "vtt") return
              const missing = await noTranscript(need().store.meetings, one.processedArgs[0] as number, need().profile)
              if (missing) throw missing
            })
          withExample(leaf)
          commands.add(leaf)
        }
      }
      return [...holder.commands]
    },
    configure: (program: Command) => {
      program.hook("preAction", (_root, chosen) => {
        action = chosen
      })
      // WC-LIFE-4: a close that fails can change the answer, so the store closes before anything is printed.
      program.hook("postAction", async () => {
        await opened?.close()
        for (const answer of answers.splice(0)) answer()
      })
    },
    prepare: async (_program: Command, _environment: RunOptions) => {
      const at = action
      if (!at || !commands.has(at)) return
      const run = environmentOf(at)
      const { settings, env, keyring } = baseContext(at, configuration.resolveSettings)
      const { profile } = settings
      const [{ openProfileStore }, { beelineFor }, { callSource }] = await Promise.all([
        import("../store.js"),
        import("../beeline.js"),
        import("../call-source.js"),
      ])
      // A command whose only write is a file (`meetings export --output`) leaves the store as it was. A search first
      // brings the transcripts' word index up to date, which writes, so it opens the store for writing unless locked.
      const indexes = pathOf(at).join(" ") === "search meetings" && readOnlyLockOf(IDENTITY, env) === undefined
      const reads = !indexes && (metaOf(at).effects?.local === "read" || (readsOverMcp(at) && !fetchesOnly(at)))
      const { store, accountId } = await openProfileStore(env, profile, reads)
      let closed: Promise<void> | undefined
      const close = () => (closed ??= store.close())
      // Still tracked: a command that fails never reaches postAction.
      run.trackCloseable?.({ close })
      let api: BeelineApi | undefined
      let source: MeetingSource | undefined
      const signedIn = () => {
        if (api) return api
        refuseOffline(at, "Beeline")
        const tokens = new ProfileTokenStore({ app: IDENTITY, env, ...(keyring ? { keyring } : {}) })
        api = beelineFor(at, tokens.need(profile))
        return api
      }
      opened = {
        store,
        accountId,
        profile,
        indexes,
        env,
        close,
        api: signedIn,
        source: () => (source ??= callSource(signedIn)),
      }
    },
  }
}
