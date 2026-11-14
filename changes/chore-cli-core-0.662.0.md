### Changed — may break callers

- **A `readonly` level no longer stops `meetings sync`** (cli-core 0.662.0, was 0.656.0). A command that only fetches
  call records into the local store runs at `readonly`; `deny` still refuses it. Commands that write the owner's
  files or call another service stay blocked by `readonly`.
- **`meetings list` and `meetings show` take `--backend archive|server|both`** (cli-core 0.660.0). beeline does not
  search Beeline from these commands, so both answer from the store. `meetings show` takes the call id, its
  `meeting:` ref or Beeline's own id, and an id it does not know is `not_found`.
- **A shared config with a small slip is mended when it is read** (cli-core 0.659.0).
  `~/.config/WireCat/config.json` with a byte-order mark, a comment, a trailing comma or a missing comma
  between two lines is fixed in place, the old file kept beside it as `config.json.bak-<time>`.

### Fixed

- **`meetings list` and `meetings show` read the store without a sign-in.** They sign in only when a command fetches
  from Beeline, so a profile that never signed in lists an empty store, as before.
