import { chmod, mkdir, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { resolvePaths } from "@wirecat/cli-base"
import type { MeetingDetails, MeetingStore } from "@wirecat/cli-core/meetings"
import { IDENTITY } from "./identity.js"

/** The setting that keeps a transcribed call's recording on this computer; true unless the owner turns it off. */
export const KEEP_RECORDINGS = "keep_recordings"

/** beeline's own state folder, one folder per profile, so Desktop plays a call from the file `meetings show` names. */
export const recordingsFolder = (env: NodeJS.ProcessEnv, profile: string): string =>
  join(resolvePaths({ appName: IDENTITY.appName, prefix: IDENTITY.envPrefix, env }).state, "recordings", profile)

const fileName = (externalId: string) => `${externalId.replace(/[^A-Za-z0-9._-]/g, "_")}.mp3`

/**
 * Writes the recording for the owner only and names it as the call's attachment, so `meetings show` gives its
 * `local_path`. A sync leaves the attachment as it is: Beeline's source lists no files of its own.
 */
export const keepRecording = async (
  store: Pick<MeetingStore, "saveMeeting">,
  details: MeetingDetails,
  bytes: Uint8Array,
  folder: string,
  now: number,
): Promise<string> => {
  await mkdir(folder, { recursive: true, mode: 0o700 })
  const path = join(folder, fileName(details.meeting.externalId))
  const partial = `${path}.partial`
  await writeFile(partial, bytes, { mode: 0o600 })
  await chmod(partial, 0o600)
  await rename(partial, path)
  const {
    id,
    createdAt,
    updatedAt,
    meetingSeriesId,
    eventId,
    participantsCount,
    manager,
    direction,
    clientPhone,
    ...meeting
  } = details.meeting
  await store.saveMeeting({
    meeting,
    attachments: [
      {
        position: 0,
        kind: "recording",
        mime: "audio/mpeg",
        name: fileName(details.meeting.externalId),
        title: null,
        url: null,
        size: bytes.byteLength,
        width: null,
        height: null,
        duration: details.meeting.durationMs,
        providerRef: { kept: "transcribe" },
        localPath: path,
        text: null,
        normalizedText: null,
        extraction: null,
        extractor: null,
        extractionError: null,
        contentSha256: null,
        extractedAt: null,
      },
    ],
    now,
  })
  return path
}
