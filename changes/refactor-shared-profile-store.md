### Changed — may break callers

- **Built on cli-core 2.0.0.** The store migrates to version 78 on first open: agents become `agent:<id>` and sender
  bots `bot:<id>`. Once a 2.0 tool opens the store, a 1.x tool refuses it, so upgrade every WireCat CLI together.

### Fixed

- **The profile's store opens through cli-core's `openProfileStore`.** beeline kept its own copy. A read, and a
  search's index refresh, still save no account, so a mistyped profile leaves nothing in the store.
- **`bin/release` is cli-template's again.** The old copy raised the version to a minor for fixes and needed an
  `## Unreleased` section beside the `changes/` fragments.
- **Three command audit exceptions are gone.** zm is now on cli-core 1.0 and later, and beeline's `account remove`
  reason matches `account rename`'s.
