# Install

Install `beeline` once on each computer where you or an agent use it. You need Node.js 22.16 or a later 22.x, or 24 or later; Node 23 is not supported.
Without Node.js, install the LTS version from [nodejs.org](https://nodejs.org/en/download) first.

`beeline` is checked on Linux with every release, transcription included. Its speech engine is WebAssembly, with no
native part of its own, so it should work on macOS and Windows too; there, a release checks only that it starts and
that `doctor` answers.

```sh
npm install -g @wirecat/beeline-cli
beeline --version
```

Check the installation, then pick a profile name for your account, such as `work`:

```sh
beeline doctor
```

`doctor` needs no network and opens no keyring. It shows the version, where settings live, the profiles that
exist, and whether other users of the computer can read the settings. Next: [use it](usage.md).
