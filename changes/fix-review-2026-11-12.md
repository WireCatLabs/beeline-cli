### Added

- `account remove --keep-data|--delete-data` forgets a profile on this computer: its Beeline token, its config entry
  and, with `--delete-data`, its calls in the store. The token itself stays valid in the Beeline cabinet.
- `guide` walks through the first calls, from `session start` to a call read as a dialogue; `complete` gives shell
  completion. Both from `@wirecat/cli-core`.
- `contracts/wirecat.json` tells WireCat Desktop what `beeline` does and that it reaches only `cloudpbx.beeline.ru`.

### Changed — may break callers

- Under `BEELINE_READ_ONLY`, `meetings export --output` writes only inside a scheduled run's work folder
  (`BEELINE_WORK_FOLDER`) and is refused elsewhere with `read-only.output-outside`. From `@wirecat/cli-core` 0.643.0.

### Security

- Every request to Beeline goes through cli-base's `hostFetch`, which reaches only `cloudpbx.beeline.ru`.

### Fixed

- `SECURITY.md` and the README no longer say the repository is private: GitHub's private vulnerability reporting is
  open.
