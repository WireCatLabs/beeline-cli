import { e164Of } from "@wirecat/cli-core"
import type { MeetingSource, SourceMeeting, SourceParticipant } from "@wirecat/cli-core/meetings"
import type { BeelineApi, CallRecord } from "./beeline-api.js"

export const PROVIDER_NAME = "beeline"

/**
 * The cursor is when the last sync began. We think `dateFrom` filters on a call's start and a record is listed only
 * once the call is over (no capture shows either), so a call still going on then would never be listed again. Beeline's
 * API page names no delay before a record appears; three hours is our choice, longer than a long sales call.
 */
export const OVERLAP_MS = 3 * 60 * 60 * 1000

const managerName = ({ firstName, lastName }: CallRecord["abonent"]) =>
  [firstName, lastName].filter((part) => part?.trim()).join(" ") || null

/** Direction, manager and client in one line, so a list, an export and a `title:` search show who spoke with whom. */
export const callTitle = (record: CallRecord): string =>
  `${record.direction === "INBOUND" ? "Входящий" : "Исходящий"} звонок · ${managerName(record.abonent) ?? "менеджер"} ↔ ` +
  `+${record.phone.replace(/^\+/, "")}`

const meetingOf = (record: CallRecord): SourceMeeting => ({
  series: null,
  occurrence: {
    id: record.id,
    seriesId: record.id,
    title: callTitle(record),
    startedAt: new Date(record.date).toISOString(),
    endedAt: new Date(record.date + record.duration).toISOString(),
  },
  metadata: {
    direction: record.direction,
    durationMs: record.duration,
    fileSize: record.fileSize,
    externalId: record.externalId,
    ...(record.callId ? { callId: record.callId } : {}),
  },
})

const participantsOf = (record: CallRecord): SourceParticipant[] => {
  const none = { joinedAt: null, leftAt: null, durationMs: null, sessions: null, metadata: {} }
  // Beeline gives the number as international digits without `+`. The `phone:` id must be the same E.164 number the
  // store keeps, or cli-core only proposes the CRM contact with that number instead of linking it (NEED-2600).
  const phone = e164Of(`+${record.phone.replace(/^\+/, "")}`, undefined) ?? null
  return [
    {
      ...none,
      // `userId` is `<phone>@<domain>`: an identity for the store, never a field anyone prints.
      identityExternalId: `abonent:${record.abonent.userId}`,
      email: record.abonent.email ?? null,
      displayName: managerName(record.abonent),
      externalId: record.abonent.extension ?? null,
      role: "manager",
    },
    {
      ...none,
      identityExternalId: `phone:${phone ?? record.phone}`,
      email: null,
      phone,
      displayName: null,
      externalId: null,
      role: "client",
    },
  ]
}

/**
 * Beeline call records as meetings for cli-core's `pull`. A record has no transcript, chat, summary or files of its
 * own: Beeline offers none through the API (its records section lists, downloads and deletes, nothing more).
 */
export const callSource = (api: BeelineApi): MeetingSource => {
  const seen = new Map<string, CallRecord>()
  return {
    provider: PROVIDER_NAME,
    name: "Beeline Cloud PBX",
    overlapMs: OVERLAP_MS,
    meetings: async (since) => {
      const meetings = new Map<string, SourceMeeting>()
      for await (const record of api.allRecords({ from: new Date(since) })) {
        seen.set(record.id, record)
        meetings.set(record.id, meetingOf(record))
      }
      return [...meetings.values()]
    },
    participants: async (id) => {
      const record = seen.get(id)
      return record ? participantsOf(record) : null
    },
    transcript: async () => null,
    chat: async () => null,
    summary: async () => null,
    files: async () => null,
  }
}
