### Added

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

- Under `BEELINE_READ_ONLY`, `meetings export --output` writes only inside a scheduled run's work folder
  (`BEELINE_WORK_FOLDER`) and is refused elsewhere with `read-only.output-outside`. From `@wirecat/cli-core` 0.643.0.

### Security

- Every request to Beeline goes through cli-base's `hostFetch`, which reaches only `cloudpbx.beeline.ru`.

### Fixed

- `meetings transcript` for a call with no transcript said only "(nothing)". It now says the call has no transcript
  yet and gives the `meetings transcribe id:<call>` to run, or says the call is shorter than five seconds; `--json`
  answers `not_found` with reason `transcript.missing` or `transcript.too-short`. `meetings export --format vtt` says
  the same.
- `meetings show`, `transcript`, `summary` and `export` take the `ref` that `meetings list` prints (`meeting:1/375`)
  as well as the plain id. Before, a ref failed with "expected a positive integer".
- `SECURITY.md` and the README no longer say the repository is private: GitHub's private vulnerability reporting is
  open.
