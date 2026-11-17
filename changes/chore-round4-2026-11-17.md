### Changed — may break callers

- **`meetings transcribe` answers `audio_ms` in place of `audio_seconds`**: the length of the audio it transcribed,
  in milliseconds, like every other length of time in a WireCat answer. Read `audio_ms` and divide by 1000 for
  seconds.
- **Each call in the `failed` list of `meetings transcribe` carries `ref`**, the reference `meetings list` prints,
  so the next command takes it as it is. Its `message` is now always the fixed wording of its `reason`, never the
  text of the error behind it.

### Fixed

- **A read on a profile that never synced, such as a mistyped one, no longer saves an account for it.**
  `meetings list`, `meetings show`, `search meetings` and the other reads answer as for a profile with no calls.
- **A refused Beeline token names the profile in the next step**: `beeline work session start`, not
  `beeline <profile> session start`.
