### Added

- **WireCat Desktop opens beeline's calls.** The manifest now names how a call opens (cli-base 0.104.0,
  `meetingsProvider`): a client's call on Desktop's Clients page and in Meetings opens in beeline, with its
  people and transcript. It needs the Desktop that reads it (0.6.9 or later); Desktop 0.6.8 refuses this manifest.
  A sync is now counted as calls (`syncs: "calls"`), not as records.
- **`meetings download <call> --output <file>`** saves one call's recording from Beeline to a new file, to listen to
  it. It never writes over a file that exists, and the file is readable only by you. Its permission key is
  `meetings.download`.
