### Added

- **WireCat Desktop signs beeline in in its own window.** The manifest now says how (cli-base's `signIn.methods`):
  Desktop asks for the API token in a hidden field and passes it to `beeline <profile> session start --json` on
  stdin, so no terminal is needed. It needs a Desktop that shows a token field for such a sign-in; an older Desktop
  offers the window but cannot finish it, so sign in at a terminal there.
