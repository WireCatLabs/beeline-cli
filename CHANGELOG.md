# Changelog

Notable changes to `@wirecat/beeline-cli`. One section per version, newest first.

## 0.1.0 — 02.11.2026

### Added

- A bare `beeline --help` opens with what beeline does, the commands to try first, and where to start.
- `wcat-beeline`, the same command under the name the `wcat` launcher finds. `wcat-beeline --wcat-describe` answers
  for `wcat --help`.
- `mcp config`, `mcp add` and `mcp check` set up an agent's connection to the MCP server, with `--profiles` and
  `--permission`. `doctor --online` also shows the store and the profile lock.
- `meetings repair`, `config migrate`, `config repair` and `--compact`, from the shared WireCat libraries.
- `--help` and the agent skill say what `beeline` does.
- `session list` lists the profiles on this computer and whether each has a Beeline token. It needs no profile and
  never shows the token. `session start` now remembers the profile, so the list finds it.
- `meetings sync` stops itself before its time limit and keeps the calls it saved. Its answer then says
  `meta.complete: false`, names the calls not reached in `remaining`, and its `next` step runs `meetings sync` again,
  which goes on from the first call it did not reach. `meetings sync --rescan` reads the last 30 days again.
- `models download --json` writes the download's byte progress to stderr, one JSON line at most twice a second.
- `meetings sync` copies the PBX's recorded calls into the local WireCat store, one meeting per call, with the manager
  and the client as its people. `meetings list`, `show`, `export`, `people` and the other shared reads answer from
  there.
- `meetings transcribe` downloads each call's recording and turns it into a dialogue between the manager and the client,
  with a speech model on this computer. `models list` and `models download` manage that model.
- `session start`, `session status` and `session end` keep the Beeline API token in the system keyring.
  `--credential-storage file` keeps it in a private file instead, not recommended. When the keyring fails, `beeline`
  uses the file by itself and says so once.
- **A pull request adds its changelog entries as a fragment, `changes/<branch>.md`.** Open pull requests no longer
  conflict under `## Unreleased`. `pnpm docs:check` checks each fragment, and `bin/release` collects them into the
  version's section. An entry under `## Unreleased` still works during the move.
- **`beeline` is published to npm as `@wirecat/beeline-cli`.** Install it with `npm install -g @wirecat/beeline-cli`;
  `upgrade` updates it from there. `bin/release` publishes it like every other WireCat CLI.
- `account remove --keep-data|--delete-data` forgets a profile on this computer: its Beeline token, its config entry
  and, with `--delete-data`, its calls in the store. The token itself stays valid in the Beeline cabinet.
- `guide` walks through the first calls, from `session start` to a call read as a dialogue; `complete` gives shell
  completion. Both from `@wirecat/cli-core`.
- `search meetings <words>` finds words in the transcripts and cites the call and the line, from cli-core's
  meeting search.
- `README.ru.md`: getting started in Russian, from installing Node.js to connecting an agent.
- `contracts/wirecat.json` tells WireCat Desktop what `beeline` does and that it reaches only `cloudpbx.beeline.ru`.

### Changed — may break callers

- `meetings transcribe --limit` is now `--max-meetings`: it caps how many calls one run transcribes, which the shared
  flag names call a budget; `--limit` means how many items an answer holds. Its answer is declared as a
  `call_transcription_report`, so `commands info` lists its fields.
- A call's title is now its direction, manager and client's phone (`Входящий звонок · Иван Петров ↔ +7 900 …`),
  so lists, exports and `title:` searches show who spoke. The next sync sets it on the calls already stored.
- `meetings summary` and `meetings import` are gone: Beeline gives no summaries, and there are no transcript files to
  import.
- A new Beeline account is saved with the `work` scope, so a work search such as b24's `search all` includes the calls.
- `meetings transcribe` lists a call over 60 minutes as failed (`recording.too-long`) without downloading it, and
  brings the search index up to date after it transcribes, so `search all` and memo find new transcripts at once.
- Under `BEELINE_READ_ONLY`, `meetings export --output` writes only inside a scheduled run's work folder
  (`BEELINE_WORK_FOLDER`) and is refused elsewhere with `read-only.output-outside`. From `@wirecat/cli-core` 0.643.0.

### Fixed

- `meetings sync --offline` is refused before the command starts, with the same `permission_error` and reason
  `offline.refused` as the other commands that need Beeline. From `@wirecat/cli-core` 0.607.0.
- A damaged store file fails as `configuration_error` (`store.damaged`) instead of a crash reported as a bug. After
  such a failure, every command that writes to the store refuses until `doctor --deep` passes; reads still work.
- When `meetings transcribe` reaches its time limit during a download or while it recognizes a call, it answers with
  the calls it finished and how many are left, instead of failing as `cancelled` or listing the call as failed. The
  speech engine stops between two pieces of speech instead of finishing the call.
- `meetings export` without `--output` is a read: it runs under `BEELINE_READ_ONLY` and through the MCP server's
  read tool, and writes nothing to the store. `--output` only ever creates a new file, readable by the owner alone, and
  refuses a file that exists. An MCP agent gets the export in the answer and cannot choose `--output`. Before,
  `--output` failed with `configuration_error`.
- A read such as `meetings list` writes nothing to the store once a sync has stored the profile's calls, also under
  `BEELINE_READ_ONLY`.
- A call record that Beeline sends in another shape fails as `invalid_response`, naming the fields and the record's
  place in the page, never its values. A record whose date came as text could crash `meetings sync`; an ISO time is
  now read as one.
- `meetings sync` no longer loses a call that was still going on during the last sync. Each sync now asks Beeline
  again for the three hours before the last one began, and also before `--since-time`. A call listed twice is stored
  once.
- A request to Beeline that does not finish in time fails as `timeout` and is tried again: 30 s for the list of
  calls, 2 min for a recording, the download itself included. Before, only the command's own time limit stopped it.
- A recording that Beeline sends without its size is counted as it arrives and refused past 256 MB, instead of being
  read whole into memory. An error answer is read only up to 64 KB. A connection that breaks halfway through a
  download is tried again.
- `session start` refuses a profile named after a command, such as `BEELINE_PROFILE=meetings`, before it asks for the
  token.
- An error keeps its own reason for a script to branch on: `session.missing` for a profile with no token, the same in
  every WireCat tool with an API token, and beeline's `token.refused`, `recording.empty`, `recording.too-large`,
  `recording.not-stereo` and `model.not-downloaded`. They arrived as the generic `auth.failed` or `config.invalid`. A missing speech model is now `not_found`, not `configuration_error`.
  Beeline's own error code is in `provider_error` and in the message, no longer in the reason.
- A `deny` in a profile's permissions stops the command: `meetings.sync: deny` no longer lets `meetings sync` call
  Beeline. Over MCP, a denied command is listed as unavailable and refused.
- The permission limits an MCP agent's run carries apply to `session` and the meetings commands too.
- `--offline` keeps its promise: `session start`, `session status --check`, `meetings sync` and `meetings transcribe`
  refuse it before any request. They called Beeline before.
- `runs show` for `session start`, `session status --check`, `meetings sync` and `meetings transcribe` now names the
  command's run and counts each request to Beeline.
- The documents say what `beeline` does: it reads call records and recordings from Beeline Cloud PBX and transcribes
  them on this computer. They said it connected to nothing.
- Under `BEELINE_READ_ONLY`, a first read on a new machine answers empty and creates no `wirecat.db`. It used to fall
  back to opening the store for writing. A sync under the lock still writes what it fetches.
- `meetings transcript` for a call with no transcript said only "(nothing)". It now says the call has no transcript
  yet and gives the `meetings transcribe id:<call>` to run, or says the call is shorter than five seconds; `--json`
  answers `not_found` with reason `transcript.missing` or `transcript.too-short`. `meetings export --format vtt` says
  the same.
- `meetings show`, `transcript` and `export` take the `ref` that `meetings list` prints (`meeting:1/375`)
  as well as the plain id. Before, a ref failed with "expected a positive integer".
- `SECURITY.md` and the README no longer say the repository is private: GitHub's private vulnerability reporting is
  open.
- The docs and the skill name the profile `work` throughout, say which commands MCP serves without
  `--allow-writes`, and say that a call with no speech is tried again on each run.

### Security

- A request that carries the API token refuses to follow a redirect, so the token goes only to Beeline.
- `contracts/wirecat.json` now names every host `beeline` reaches, not only `cloudpbx.beeline.ru`: npm for
  `upgrade`, Hugging Face and GitHub for `models download`. From `@wirecat/cli-base` 0.99.0.
- Every request to Beeline goes through cli-base's `hostFetch`, which reaches only `cloudpbx.beeline.ru`.
