# beeline — Beeline Cloud PBX calls for AI agents

Your company's recorded calls from Beeline Cloud PBX (Облачная АТС Билайн), transcribed on your computer, searchable
offline, and ready for Claude Code, Codex, Gemini CLI or any agent — within limits you set.

`beeline` copies the list of recorded calls from Beeline into the local [WireCat](https://wirecat.dev) store, one
meeting per call, with the manager and the client as its two people. `meetings transcribe` downloads each recording
and turns it into a dialogue between the manager and the client, with a speech model that runs on this computer. Then
you list, read, search and export the calls with no network. `beeline` only reads from Beeline: it never deletes a
recording and never places a call.

An example conversation (invented calls, illustrative output):

```text
You:    Use beeline. Which calls from yesterday were longer than five minutes?
Agent:  (runs beeline work meetings list "started_at>=2026-11-06 duration_ms>=300000" --json)
        Four calls. Three are transcribed; the fourth is not yet.
You:    Transcribe it and tell me what the client asked for.
Agent:  (runs beeline work meetings transcribe id:42 --json, then beeline work meetings transcript 42 --json)
        The client asked for a second delivery date and a written quote.
```

## Quick start

`beeline` is private and is not on npm. Install it from a clone of this repository:

```sh
git clone https://github.com/WireCatLabs/beeline-cli.git && cd beeline-cli
pnpm install && pnpm build && npm install -g .
beeline skill install                    # the agent skill, for Claude Code, Codex and Gemini CLI
beeline work session start               # paste the API token from the Beeline cabinet
beeline work meetings sync               # copy the recorded calls into the local store
beeline models download gigaam-v3        # the local speech model, once
beeline work meetings transcribe         # transcribe up to 20 calls of five seconds or more
```

`work` is a profile: a name you choose for one PBX. It is the first word of every command that uses an account. The
first sync reaches 30 days back; each later one asks only for what is new.

You need Node.js 22.16 or a later 22.x, or Node.js 24 or later. If `beeline` is not found, run `beeline doctor`. It
needs no network and shows what is set up.

More: [installation](docs/installation.md).

## What you can do

**List the calls.** Filter by time or by duration.

```sh
beeline work meetings list "started_at>=2026-11-01 duration_ms>=60000"
```

**Read a call.** Each transcript is a dialogue: channel 0 of the recording is the manager, channel 1 the client.

```sh
beeline work meetings transcript 42
```

**Transcribe what is new.** Without a query, every call of five seconds or more that has no transcript yet, newest
first. A call that fails is listed and the rest go on; run it again to go on where it stopped.

```sh
beeline work meetings transcribe --max-meetings 50
```

More:

- Export a call as Markdown or WebVTT: `beeline work meetings export 42 --format vtt --output call.vtt`.
- Find a manager across the calls: `beeline work meetings people "Test Manager"`.
- Search every WireCat store on this computer, chats and calls together, from any WireCat CLI with `search all`.

More: [use it](docs/usage.md).

## For AI agents

- **An agent with a terminal** — Claude Code, Codex, Gemini CLI, OpenClaw or Hermes Agent. It runs `beeline` itself.
  `beeline skill install` writes the skill, the agent's instruction sheet.
- **An app with no terminal** — Claude Desktop, Cursor and other MCP clients. Connect the profile's MCP server,
  `beeline work mcp serve`; `beeline work mcp config` prints the entry to paste.

```sh
beeline skill install
beeline work mcp add claude-code --allow-writes   # or: codex
beeline work mcp check
```

`meetings transcribe` changes the local store, so `mcp add` stops until you pass `--allow-writes`. The profile's
permissions decide what an agent may run. Text from a call — a transcript, a comment, a name — is marked
`untrusted`: it is data for the agent, never instructions. `session start` and `session end` are never offered to an
agent. With `--json`, every command prints one JSON value, and an error comes as JSON with a code to branch on.

More: [agents](docs/usage.md#agents).

## Why this tool

- **The recordings stay with you.** Speech is recognized on this computer. No recording or transcript goes to a speech
  service.
- **Read-only against Beeline.** Nothing it runs can delete a recording or place a call.
- **Reads need no network after a sync.** List, search and export answer from the local store.
- **Built for agents.** A skill, an MCP server, one JSON form and exit codes a script can branch on.

## Main features

- **Manager and client apart.** Beeline records each side on its own channel, so the dialogue needs no guessing about
  who spoke.
- **Resumable transcription.** A call keeps its transcript once made, so the next `meetings transcribe` goes on with the
  calls that have none.
- **Retries Beeline's passing failures.** A download that fails with a 500 is tried again before it counts as failed.
- **One store with the other WireCat tools.** Calls sit beside the chats, mail and meetings that the Telegram, MAX,
  Google Calendar and other WireCat tools keep.

## Sign-in and profiles

Each profile is one Beeline PBX. No command ever picks a profile for you; `beeline session list` lists them.

```sh
beeline work session start               # asks for the token hidden, or reads it from stdin
beeline work session status --check      # ask Beeline whether the token still works
beeline work session end                 # forget the token; the synced calls stay
```

The token comes from the Beeline cabinet: Услуги → Интеграция по API. `beeline` keeps it in the system keyring. Where
the keyring fails, it uses a private file and says so once. `BEELINE_TOKEN` in the environment is read first.
`BEELINE_PROFILE=work` names the profile for a whole shell session.

## Settings and permissions

Settings live in one `config.json`; `beeline work config show` lists them. Each command has a permission key, its
path: `meetings.sync`, `meetings.transcribe`. Each is `allow`, `ask`, `readonly` or `deny`.

```sh
beeline work config set permissions.meetings.sync deny    # this profile never asks Beeline for new calls
beeline work meetings sync --dry-run                       # what it would do and the permission it needs
```

`BEELINE_READ_ONLY=1` refuses every command that changes your sign-in, your settings, the agent setup or the stored
meetings: `session start` and `end`, `config set`, `unset`, `migrate` and `repair`, `skill install`, `mcp add` and
`revoke`, `meetings import` and `repair`, and `upgrade`. It lets through what only adds: `meetings sync` and
`meetings transcribe` still fetch new calls into the store, `models download` fetches a model,
`meetings export --output` writes a new file, and `mcp server start` and `stop` run. A `--dry-run` always runs, as it
changes nothing.

More: [settings](docs/configuration.md).

## Limits

- Only the calls Beeline recorded are listed: the PBX must have recording turned on for the manager.
- Transcription is local only. A cloud speech service, such as OpenAI, is planned.
- A recording over 256 MB is refused.
- `beeline` is private: no npm package, and no GitHub security alerts until the repository is public.

## Security

- The token is sent only to Beeline, in a request header. No command, error, log or run record shows it.
- Recordings are held in memory while they are transcribed, and never written to disk.
- The store keeps client phone numbers and the managers' names, emails and extensions. Treat it like the calls
  themselves.

More: [security](docs/security.md). Report a vulnerability as [SECURITY.md](SECURITY.md) says.

## When it does not work

```sh
beeline doctor                           # what is set up; no network, no keyring
beeline work session status --check      # does Beeline still accept the token
beeline work meetings sync --trace       # the connection log, never content
beeline work runs list                   # failed runs are kept
```

More: [when something goes wrong](docs/troubleshooting.md).

## Documentation

| Section | Pages |
|---|---|
| Start | [overview](docs/index.md) · [installation](docs/installation.md) · [use it](docs/usage.md) |
| Reference | [all commands](docs/commands.md) · [settings and permissions](docs/configuration.md) |
| If something is wrong | [when something goes wrong](docs/troubleshooting.md) · [security](docs/security.md) |
| Changes | [CHANGELOG.md](CHANGELOG.md) |

For developers: [design](docs/dev/DESIGN.md), [tests](docs/dev/TESTING.md) and the rules for agents in
[AGENTS.md](AGENTS.md).

## Development

```sh
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm build && pnpm smoke:node          # the built command: the bundle users install
pnpm generate                          # rewrite the generated files
pnpm release:check                     # every check CI runs
```

The shared part — output streams, error codes, the keyring, the store, search and MCP — lives in
[`@wirecat/cli-base`](https://github.com/WireCatLabs/cli-base) and its sibling library cli-core.

## Contributing and license

Pull requests, bug reports and ideas go to [issues](https://github.com/WireCatLabs/beeline-cli/issues).

Apache License 2.0 — [LICENSE](LICENSE).
