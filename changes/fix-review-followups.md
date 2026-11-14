### Changed — may break callers

- **`meetings` and `events` commands take the program's `--json [fields]` and `--jsonl`** (cli-core 0.663.0, was
  0.662.0), not their own on/off flags, so `meetings list --json id,title` keeps those fields.
- **`meetings list`, `events list` and `search meetings` without `--limit` show the profile's `defaults.limit`**, 20
  unless set, not 100. `runs list` reads it too.
- **Every time flag takes one grammar** (cli-base 0.100.0, was 0.99.0): ISO with or without seconds and zone, a date
  alone, `today`, `yesterday`, or `30m`, `2h`, `7d` ago. `meetings sync --since-time 2h` now works.
