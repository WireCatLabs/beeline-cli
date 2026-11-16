import { writeFile } from "node:fs/promises"
import { CliError } from "@wirecat/cli-base"
import { annotate } from "@wirecat/cli-base/commands"
import { answerEntity, baseContext, ownerOnlyOption, refuseOffline, writesNewFileOnlyWith } from "@wirecat/cli-core/cli"
import type { MeetingStore } from "@wirecat/cli-core/meetings"
import { Command } from "commander"
import * as v from "valibot"
import type { BeelineApi } from "../beeline.js"
import { configuration } from "../config.js"
import { IDENTITY } from "../identity.js"

export interface DownloadDeps {
  store: () => MeetingStore
  accountId: () => number
  api: () => Pick<BeelineApi, "recording">
  meetingId: (text: string) => number
  write: (saved: SavedRecording, command: Command) => void
}

const SAVED = v.strictObject({
  meeting: v.number(),
  provider_id: v.string(),
  output: v.string(),
  bytes: v.number(),
})

export type SavedRecording = v.InferOutput<typeof SAVED>

/** cli-core's `writeNewFile` takes text only; a recording is bytes, kept with the same rule: never over a file. */
const writeNew = async (path: string, bytes: Uint8Array) => {
  try {
    await writeFile(path, bytes, { flag: "wx", mode: 0o600 })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      throw new CliError("validation_error", "output file already exists; choose another path", { param: "--output" })
    throw error
  }
}

export const downloadCommand = (deps: DownloadDeps): Command => {
  const output = ownerOnlyOption("--output <file>", "the new file to write; one that exists is refused")
  const base = annotate(new Command("download"), {
    effects: { remote: "read", local: "write" },
    // An agent over MCP cannot name a file to write; it reads the transcript instead.
    mcp: false,
    examples: [`${IDENTITY.command} work meetings download 375 --output call-375.mp3 --json`],
  }).addOption(output.makeOptionMandatory())
  const command = writesNewFileOnlyWith(answerEntity(base, "call_recording", SAVED), "output")
    .summary("save one call's recording from Beeline to a new file")
    .description(
      "download the recording of a stored call from Beeline and write it to a new file of your choice; " +
        "meetings transcribe already keeps a copy for WireCat Desktop unless keep_recordings is false",
    )
    .argument("<meeting>", "stored call id, or the ref meetings list prints (meeting:1/375)", deps.meetingId)
  return command.action(async function (this: Command, id: number, opts: { output: string }) {
    const context = baseContext(this, configuration.resolveSettings)
    const details = await deps.store().meeting(id)
    if (!details || details.meeting.accountId !== deps.accountId())
      throw new CliError("not_found", `no call ${id} in this profile; see ${IDENTITY.command} meetings list`, {
        meeting: id,
      })
    refuseOffline(this, "Beeline")
    const providerId = details.meeting.externalId
    const bytes = await context.run(() => deps.api().recording(providerId))
    await writeNew(opts.output, bytes)
    deps.write({ meeting: id, provider_id: providerId, output: opts.output, bytes: bytes.byteLength }, this)
  })
}
