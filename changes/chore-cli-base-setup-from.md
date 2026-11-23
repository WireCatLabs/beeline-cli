### Added

- **WireCat Desktop shows the guided sign-in of `beeline <profile> setup` instead of the bare token field.** The
  manifest Desktop reads now names `signIn.setupFrom` (cli-base 0.128.0), so Desktop asks `setup show` for the steps.
  Nothing changes at the terminal.
