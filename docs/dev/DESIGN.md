# beeline — design

What `beeline` is for and the decisions that shape it. Started from `npx @wirecat/cli-template new`; the answers below
are the owner's.

## Answers

- **Category:** meetings
- **Content languages:** ru
- **Sign-in:** an API token or key
- **The API:** official API documentation only
- **How people filter:** by time, by person, by status or label
- **Never in the store, a log or the output:** tokens and passwords
- **Untrusted input:** files and attachments, names and titles set by others

## Reference CLI

Learn from [zoom-cli](https://github.com/WireCatLabs/zoom-cli).

## Content languages

Languages: ru.

## Further answers

Owner, 2026-10-31.

- **Purpose:** pull a company's sales call recordings from Beeline Cloud PBX, transcribe them, grade each call against a
  rubric and context files, and aggregate the grades.
- **A call is a meeting** in cli-core's shared store: `meetings sync` pulls call records, one meeting each, with the
  manager and the client as participants. Search, export and the other shared reads come with it.
- **Read-only against Beeline.** The API also deletes recordings and places calls; the CLI calls neither.
- **Transcription is local.** OpenAI is planned as an option (`--with openai`), added to cli-core for every WireCat CLI,
  and not offered yet. Once it is, recordings and transcripts may go to OpenAI or Anthropic when the owner asks.
- **Recordings are stereo, one speaker per channel**: each channel is transcribed on its own and merged by time, so no
  speaker detection is needed. Source: the live check of 2026-10-31 on real calls; Beeline's API page says
  nothing about channels.
- **Channel 0 is the manager, channel 1 the client**, on outgoing and incoming calls alike. Source: the same live check,
  on one outgoing and two incoming calls (`src/call-transcription.ts`).
- **`meetings transcribe` picks calls with `meetings list`'s query.** Without one, `duration_ms>=5000`: the owner's
  threshold, since shorter calls are mostly no answer. It runs locally, is cooperative and resumable, and a call that
  fails is listed while the rest go on. Beeline's downloads fail with a passing 500 (6 of 20 downloads in the live check
  of 2026-10-31, each fine on the next try), so every read is retried.
- **OpenAI transcription waits for cli-core to export its key reader**; the CLI does not copy cli-core's key logic.
- **Grading:** one question per criterion, `pass / fail / n/a`, an evidence quote checked against the transcript, the
  score computed in code.

## The API

Beeline documents its API only inside the cabinet, behind the sign-in: Услуги → Интеграция по API → the documentation,
section «Операции с записями разговоров». It has no public address to link. What `src/beeline-api.ts` relies on from
that page: `GET /records` lists at most 100 records per call, in order after the `id` given, narrowed by `userId`,
`dateFrom` and `dateTo`; `GET /v2/records/{recordId}/download` returns the file; the token goes in the
`X-MPBX-API-AUTH-TOKEN` header. A wrong token is answered with 403, not 401 (live check, 2026-10-31).

## Every request inside cli-core's run

`session start`, `session status --check` and `meetings transcribe` ask Beeline inside `baseContext(...).run()`, and
`meetings sync` inside cli-core's own run: `addMeetingCommands` takes `inRun`, which beeline sets to cli-core's
`inCommandRun` (cli-core 0.598.0). `beelineApi` times each request with `providerRequest`, so each run carries its own
`run_id` and the request count (WC-LIFE-15), and `run()` bounds every command by its deadline.
`src/calls.test.ts` checks both for `session status --check` and `meetings sync`.

## A call's client and the CRM contact with its number

Owner, 2026-11-13 (NEED-2600 A). The client participant carries its number as `phone`, and its identity is
`phone:<E.164>`. Beeline gives the client's 10-digit national number (`9XXXXXXXXX`, counted in the owner's store on
2026-11-13), so `clientPhone` in `src/call-source.ts` reads it in Russia's plan: `e164Of` leaves a national number's
country to the source, and Beeline is a Russian PBX. A number that plan does not read (an extension, a foreign number)
keeps its raw digits in the id and gets no phone.

A store written by an unpublished build before this fix keeps `phone:<national>` ids (the owner's: 1626 of them on
2026-11-13). They stay until cli-core offers an identity rename and merge and beeline calls it once on a writable
open; beeline writes no SQL of its own. A fresh install is not affected. cli-core links the callers a sync saved
to the CRM contact that holds the same number: at once for a mobile only the two of them hold, as a proposal for a
landline, which everyone in an office shares. It joins only when the identity is exactly `phone:<E.164>`, so the `+`
must be there. The manager is keyed by Beeline's `abonent` and gets no phone: an extension is the company's, not a
person's. `src/calls.test.ts` checks both cases against a Bitrix24 contact.

## Open questions for the owner
