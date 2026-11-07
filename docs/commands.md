<!-- Generated from the command tree by pnpm generate. Do not edit. -->

# Commands

Every command, option and exit code, generated from the program itself. For the same list as JSON, run
`beeline commands --json`.

**The first word is the profile**, a name you choose: `beeline personal config show`. `BEELINE_PROFILE`
does the same for a whole shell session. No profile is assumed: a command that uses an account stops without one and
lists the profiles on this computer.

## Options for every command

| Option | What it does |
|---|---|
| `-V, --version` | output the version number. |
| `-v, --verbose` | more detail in what is shown: -v ids, -vv everything we know. Default: `0`. |
| `--json` | machine-readable output: one JSON value on stdout; --json=id,text keeps only those fields. |
| `--jsonl` | machine-readable output: one JSON object per line, for streaming and jq. |
| `--quiet` | diagnostics off; a failure is still said. |
| `--trace` | the connection's own log lines on stderr — never content. |
| `--debug` | on a failure, its whole record — cause and stack — in place of the short line. |
| `--timeout <duration>` | give up on the whole command after this — 30s, 2m, 500ms. |
| `--offline` | answer from what was recorded and never connect; fails if nothing was. |
| `--no-input` | never prompt or open interactive login; piped input remains available. |
| `--max-input-bytes <bytes>` | maximum buffered input bytes (default: 16777216). |
| `--max-output-bytes <bytes>` | maximum machine output bytes (default: 4194304; 0 disables). |
| `--brief` | found items as reference, title, time, author and excerpt only. |
| `--full` | found items with their whole text and every provider field. |
| `--compact` | one line per item for an agent: reference first, text last, paging and next steps as # lines. |
| `--dry-run` | preview parsed arguments and permissions before running the action. |
| `--yes` | go ahead without the question an ask level puts before a write. |
| `--record` | keep this run even where the config says record false; record_input false leaves the typed words out. |
| `--no-record` | do not keep this run, even if it fails. |

## `beeline commands`

every command by section; --json prints its contract, one path per call

### `beeline commands info`

one command contract, or all schemas, error reasons and explicit overrides

```sh
beeline commands info [path]
```

| Argument | | What it is |
|---|---|---|
| `path` | optional | one command path; without one, export schemas, error reasons and explicit overrides. |

**Returns:** one command contract, or all schemas, error reasons and explicit overrides

**Example:** `beeline commands info commands`

## `beeline session`

keep this profile's Beeline API token in the OS keyring

### `beeline session start`

sign this profile in: the API token (Beeline cabinet → Услуги → Интеграция по API) is asked hidden or read from stdin, checked against Beeline, and only then kept in the keyring, or in a private file when the keyring fails

**Changes something on this computer only.**

```sh
beeline session start [options]
```

| Option | What it does |
|---|---|
| `--credential-storage <storage>` | where the token is kept: keyring (the default, which falls back to a private file by itself when no keyring works), or file, not recommended. Default: `keyring`. |

**Returns:** sign in with the Beeline API token

**Example:** `beeline work session start`

### `beeline session status`

show where this profile's token comes from: BEELINE_TOKEN, the keyring or a file; never the token

```sh
beeline session status [options]
```

| Option | What it does |
|---|---|
| `--check` | ask Beeline to prove the token still works. |

**Returns:** show where this profile's token comes from; never the token

**Example:** `beeline work session status`, `beeline work session status --check --json`

### `beeline session end`

forget this profile's token on this computer; synced calls stay

**Changes something on this computer only.**

```sh
beeline session end
```

**Returns:** forget this profile's token on this computer; synced calls stay

**Example:** `beeline work session end`

### `beeline session list`

list the profiles on this computer and whether each has a Beeline token; picks none

```sh
beeline session list
```

**Returns:** list the profiles here and whether each is signed in

**Example:** `beeline session list`, `beeline session list --json`

## `beeline meetings`

stored meetings and their records

### `beeline meetings list`

stored meetings, newest first

```sh
beeline meetings list [query] [options]
```

| Argument | | What it is |
|---|---|---|
| `query` | optional | field:value terms that narrow the list — the fields are below. |

| Option | What it does |
|---|---|
| `--json` | one JSON value. |
| `--jsonl` | one JSON object per item. |
| `--limit <n>` | meetings per page. Default: `100`. |
| `--page <n>` | page number. Default: `1`. |

**Returns:** meeting — ref, id, provider, account, title, url, started_at, ended_at, and 8 more; every field: beeline commands info meetings list

**Next usually:** `beeline meetings show <meeting>`, `beeline meetings transcript <meeting>`, `beeline meetings summary <meeting>`

**Example:** `beeline work meetings list --limit 20 --json`

### `beeline meetings show`

show a stored meeting

```sh
beeline meetings show <meeting> [options]
```

| Argument | | What it is |
|---|---|---|
| `meeting` | required | stored meeting id. |

| Option | What it does |
|---|---|
| `--json` | one JSON value. |
| `--jsonl` | one JSON object per item. |

**Returns:** meeting details — ref, id, provider, account, title, url, started_at, ended_at, and 16 more; every field: beeline commands info meetings show

**Next usually:** `beeline meetings transcript <meeting>`, `beeline meetings summary <meeting>`, `beeline meetings export <meeting>`

**Example:** `beeline work meetings show 1 --json`

### `beeline meetings transcript`

show current meeting transcripts

```sh
beeline meetings transcript <meeting> [options]
```

| Argument | | What it is |
|---|---|---|
| `meeting` | required | stored meeting id. |

| Option | What it does |
|---|---|
| `--history` | include superseded transcript versions. |
| `--json` | one JSON value. |
| `--jsonl` | one JSON object per item. |

**Returns:** meeting transcript — ref, meeting, source, language, superseded_at, created_at, lines; every field: beeline commands info meetings transcript

**Example:** `beeline work meetings transcript 1 --json`

### `beeline meetings summary`

show stored meeting summaries

```sh
beeline meetings summary <meeting> [options]
```

| Argument | | What it is |
|---|---|---|
| `meeting` | required | stored meeting id. |

| Option | What it does |
|---|---|
| `--json` | one JSON value. |
| `--jsonl` | one JSON object per item. |

**Returns:** meeting summary — id, meeting, source, title, overview, sections, next_steps, content, and 3 more; every field: beeline commands info meetings summary

**Next usually:** `beeline meetings show <meeting>`, `beeline meetings transcript <meeting>`, `beeline meetings export <meeting>`

**Example:** `beeline work meetings summary 1 --json`

### `beeline meetings export`

export a meeting as Markdown or one transcript as WebVTT

**Changes something on this computer only.**

```sh
beeline meetings export <meeting> [options]
```

| Argument | | What it is |
|---|---|---|
| `meeting` | required | stored meeting id. |

| Option | What it does |
|---|---|
| `--format <format>` | export format. One of: `markdown`, `vtt`. Default: `markdown`. |
| `--transcript-id <id>` | export a specific transcript version. |
| `--output <file>` | write content to a file through the host's writer. |
| `--json` | one JSON value. |
| `--jsonl` | one JSON object per item. |

**Returns:** meeting export — meeting_id, format, filename, content, output; every field: beeline commands info meetings export

**Example:** `beeline work meetings export 1 --format markdown --json`

### `beeline meetings people`

find meeting participants by name or email

```sh
beeline meetings people <query> [options]
```

| Argument | | What it is |
|---|---|---|
| `query` | required | a name or an email address. |

| Option | What it does |
|---|---|
| `--json` | one JSON value. |
| `--jsonl` | one JSON object per item. |
| `--limit <n>` | most matching observations per page, 1–1000 (default 50). |
| `--scan-limit <n>` | most participant observations to inspect, 1–10000 (default 1000). |
| `--max-read-bytes <bytes>` | most stored name and email bytes to read (default 1048576). |
| `--cursor <cursor>` | continue with the same name query and selected account. |

**Returns:** meeting participants — schema_version, kind, account_id, query, items, ambiguity, coverage, page; every field: beeline commands info meetings people

**Example:** `beeline work meetings people "Test Manager" --json`

### `beeline meetings sync`

bring the stored meetings up to date from the connected account

**Changes something on this computer only.**

```sh
beeline meetings sync [options]
```

| Option | What it does |
|---|---|
| `--json` | one JSON value. |
| `--jsonl` | one JSON object per item. |
| `--since-time <time>` | fetch meetings starting at or after this ISO 8601 date or time. |
| `--lookback-days <days>` | revisit recent occurrences for late transcripts (0–31). Default: `0`. |

**Returns:** meeting ingestion — meetings, participants, transcript_rows, summaries, warnings, timezone; every field: beeline commands info meetings sync

**Example:** `beeline work meetings sync --since-time 2026-08-01T00:00:00Z --json`

### `beeline meetings import`

import downloaded meeting transcripts

**Changes something on this computer only.**

```sh
beeline meetings import <folder> [options]
```

| Argument | | What it is |
|---|---|---|
| `folder` | required | folder of transcripts downloaded from the provider. |

| Option | What it does |
|---|---|
| `--json` | one JSON value. |
| `--jsonl` | one JSON object per item. |

**Returns:** meeting ingestion — meetings, participants, transcript_rows, summaries, warnings, timezone; every field: beeline commands info meetings import

**Example:** `beeline work meetings import ./transcripts --json`

### `beeline meetings repair`

preview filling in what older builds left out of stored transcripts (their language); --yes stores it

**Changes something on this computer only.**

```sh
beeline meetings repair [options]
```

| Option | What it does |
|---|---|
| `--json` | one JSON value. |
| `--jsonl` | one JSON object per item. |
| `--yes` | store the detected languages; otherwise only preview. |

**Returns:** meeting repair — account_id, applied, transcripts, languages; every field: beeline commands info meetings repair

**Example:** `beeline work meetings repair --json`

### `beeline meetings transcribe`

download each call's recording and recognize the manager and the client with a local speech model

**Changes something on this computer only.**

```sh
beeline meetings transcribe [query] [options]
```

| Argument | | What it is |
|---|---|---|
| `query` | optional | field:value terms that pick the calls (default duration_ms>=5000) — the fields are below. |

| Option | What it does |
|---|---|
| `--replace` | transcribe calls that already have a transcript too, replacing it. |
| `--max-meetings <n>` | at most this many calls transcribed, newest first. Default: `20`. |
| `--model <model>` | local speech model. Default: `gigaam-v3`. |

**Returns:** call transcription report — transcribed, audio_seconds, failed, remaining, stopped; every field: beeline commands info meetings transcribe

**Example:** `beeline work meetings transcribe --max-meetings 20 --json`, `beeline work meetings transcribe duration_ms>=60000 --json`, `beeline work meetings transcribe id:4494 --replace --json`

## `beeline events`

the owner's stored events

### `beeline events list`

list stored events

```sh
beeline events list [query] [options]
```

| Argument | | What it is |
|---|---|---|
| `query` | optional | event id, origin or time fields that narrow the list. |

| Option | What it does |
|---|---|
| `--json` | one JSON value. |
| `--jsonl` | one JSON object per item. |

**Returns:** event — id, event_series_id, title, description, location, starts_at, ends_at, timezone, and 13 more; every field: beeline commands info events list

**Example:** `beeline work events list --json`

## `beeline models`

models that run on this machine

### `beeline models list`

speech and embedding models, their download status and the default of each kind

```sh
beeline models list [query]
```

| Argument | | What it is |
|---|---|---|
| `query` | optional | field:value terms that narrow the list — the fields are below. |

**Returns:** model — id, kind, title, languages, size_bytes, downloaded, default, path, and 1 more; every field: beeline commands info models list

**Next usually:** `beeline models download <model>`

**Example:** `beeline models list`, `beeline models list kind:audio`

### `beeline models download`

download and verify one speech or embedding model

**Changes something on this computer only.**

```sh
beeline models download <model> [options]
```

| Argument | | What it is |
|---|---|---|
| `model` | required | a model id from models list. |

| Option | What it does |
|---|---|
| `--offline` | refuse a download that needs the network. |
| `--accept-terms` | accept the model's licence terms, for a model that has its own. |

**Returns:** model — id, kind, title, languages, size_bytes, downloaded, default, path, and 1 more; every field: beeline commands info models download

**Example:** `beeline models download parakeet-v3`

## `beeline doctor`

the state this installation is in, without connecting unless --online

```sh
beeline doctor [options]
```

| Option | What it does |
|---|---|
| `--online` | also connect once and read the account; sends nothing. |

**Returns:** the state this installation is in, without connecting unless --online

**Example:** `beeline doctor`, `beeline doctor --json`

## `beeline skill`

the instructions an agent is given for this tool

### `beeline skill show`

print SKILL.md — `beeline skill install` puts it where Claude Code, Codex, Gemini CLI and OpenClaw look for it, and where Hermes does on request; --for prints the copy already there

```sh
beeline skill show [options]
```

| Option | What it does |
|---|---|
| `--for <agents>` | print the copy installed for these agents instead of this version's. One of: `claude`, `agents`. |

**Returns:** print the tool's instructions for AI agents

**Example:** `beeline skill show`

### `beeline skill install`

write SKILL.md to \~/.claude/skills/beeline-cli/ (Claude Code) and \~/.agents/skills/beeline-cli/ (Codex, Gemini CLI, OpenClaw); --for hermes also has Hermes read \~/.agents/skills, which changes Hermes's own settings, so all leaves it out

**Changes something on this computer only.**

```sh
beeline skill install [options]
```

| Option | What it does |
|---|---|
| `--for <agents>` | which agents to install for. One of: `claude`, `agents`, `hermes`, `all`. Default: `all`. |

**Returns:** install the tool's instructions for AI agents

**Example:** `beeline skill install --for agents`

### `beeline skill status`

for each place `beeline skill install` writes to, and for the copy Hermes reads: the path, the version installed there, and whether it is current, stale, missing or unversioned

```sh
beeline skill status
```

**Returns:** whether the installed instructions for AI agents match this version

**Example:** `beeline skill status`, `beeline skill status --json`

## `beeline mcp`

serve this profile to an agent over MCP and set it up — `claude mcp add beeline -- beeline <profile> mcp serve`

### `beeline mcp serve`

serve this profile to an agent over MCP, on stdin and stdout — `claude mcp add beeline -- beeline <profile> mcp serve`; `beeline mcp serve --profiles a,b` or `--profiles all` serves those profiles from one server and each tool asks which

**Changes something in the service.**

```sh
beeline mcp serve [options]
```

| Option | What it does |
|---|---|
| `--permission <key=level>` | make a permission stricter for this server only, like meetings.sync=deny; it never loosens the profile; repeat for more keys. |
| `--profiles <names\|all>` | serve several profiles from one server instead of one: names, comma-separated, or all for every profile. |
| `--http` | serve over HTTP on 127.0.0.1 for ChatGPT and Claude in the browser, behind your tunnel; the profile's permissions decide. |
| `--port <port>` | the local port for --http (default 8765). |
| `--public-url <url>` | the tunnel's https address the browser apps use, e.g. https://<name>.ts.net or https://<name>.ts.net/tg. |

**Returns:** serve this profile's commands to an AI agent

**Example:** `beeline personal mcp serve`, `beeline mcp serve --profiles work,personal`, `beeline personal mcp serve --http --public-url https://laptop.example.ts.net`

### `beeline mcp revoke`

forget every login `mcp serve --http` gave a browser app, of this profile or of the server `--profiles` names; each app must log in again

**Changes something on this computer only.**

```sh
beeline mcp revoke [options]
```

| Option | What it does |
|---|---|
| `--profiles <names\|all>` | serve several profiles from one server instead of one: names, comma-separated, or all for every profile. |

**Returns:** forget every login given to a browser app

**Example:** `beeline personal mcp revoke`, `beeline mcp revoke --profiles all`

### `beeline mcp server`

start, stop and check `mcp serve --http` in the background; status shows the login code for a browser app

#### `beeline mcp server start`

start `mcp serve --http` apart from this shell and answer once it listens, with its login code

**Changes something on this computer only.**

```sh
beeline mcp server start [options]
```

| Option | What it does |
|---|---|
| `--port <port>` | the local port (default 8765). |
| `--public-url <url>` | the tunnel's https address the browser apps use, e.g. https://<name>.ts.net or https://<name>.ts.net/tg. |
| `--permission <key=level>` | make a permission stricter for this server only; repeat for more keys. |
| `--profiles <names\|all>` | the server of several profiles that `mcp serve --profiles` serves: names, comma-separated, or all. |

**Returns:** start the HTTP MCP server in the background

**Example:** `beeline personal mcp server start --public-url https://laptop.example.ts.net`

#### `beeline mcp server stop`

stop `mcp serve --http` — only one that `mcp server start` started

**Changes something on this computer only.**

```sh
beeline mcp server stop [options]
```

| Option | What it does |
|---|---|
| `--profiles <names\|all>` | the server of several profiles that `mcp serve --profiles` serves: names, comma-separated, or all. |

**Returns:** stop the background HTTP MCP server

**Example:** `beeline personal mcp server stop`

#### `beeline mcp server status`

whether `mcp serve --http` runs, on which port and address, the login code for a new browser app, and the apps logged in

```sh
beeline mcp server status [options]
```

| Option | What it does |
|---|---|
| `--profiles <names\|all>` | the server of several profiles that `mcp serve --profiles` serves: names, comma-separated, or all. |

**Returns:** whether the HTTP MCP server runs, its login code and the apps logged in

**Example:** `beeline personal mcp server status --json`

### `beeline mcp config`

print the mcpServers entry for Claude Desktop, Cursor and others, with full paths; writes nothing

```sh
beeline mcp config [options]
```

| Option | What it does |
|---|---|
| `--permission <key=level>` | make a permission stricter for this server only, like meetings.sync=deny; it never loosens the profile; repeat for more keys. |
| `--profiles <names\|all>` | serve several profiles from one server instead of one: names, comma-separated, or all for every profile. |

**Returns:** print the local MCP configuration of this profile, or of those --profiles names

**Example:** `beeline personal mcp config`, `beeline mcp config --profiles all`

### `beeline mcp add`

add this profile's local MCP server to Codex or Claude Code

**Changes something on this computer only.**

```sh
beeline mcp add <client> [options]
```

| Argument | | What it is |
|---|---|---|
| `client` | required | codex or claude-code. |

| Option | What it does |
|---|---|
| `--allow-writes` | acknowledge that this profile offers writing tools. |
| `--permission <key=level>` | make a permission stricter for this server only, like meetings.sync=deny; it never loosens the profile; repeat for more keys. |

**Returns:** add this profile's local MCP server to Codex or Claude Code

**Example:** `beeline personal mcp add codex --allow-writes`

### `beeline mcp check`

check this profile's local MCP handshake and tool list

```sh
beeline mcp check [options]
```

| Option | What it does |
|---|---|
| `--permission <key=level>` | make a permission stricter for this server only, like meetings.sync=deny; it never loosens the profile; repeat for more keys. |

**Returns:** check this profile's local MCP handshake and tool list

**Example:** `beeline personal mcp check`

## `beeline upgrade`

upgrade beeline with the package manager that installed it; --check only looks

**Changes something on this computer only.**

```sh
beeline upgrade [options]
```

| Option | What it does |
|---|---|
| `--check` | say whether a newer version exists, and install nothing. |

**Returns:** upgrade beeline with the package manager that installed it; --check only looks

**Example:** `beeline upgrade --check`

## `beeline config`

the settings in force, and where each one came from

### `beeline config show`

the profile, the profiles that exist, and each setting with where it came from

```sh
beeline config show
```

**Returns:** the profile, the profiles that exist, and each setting with where it came from

**Example:** `beeline personal config show`

### `beeline config set`

save a setting to the configuration file

**Changes something on this computer only.**

```sh
beeline config set <setting> <value> [options]
```

| Argument | | What it is |
|---|---|---|
| `setting` | required | one of: limit, timeout_ms, color, record, record_input, keep_runs_for_days, keep_successful_runs_for_days, runs_size_limit_mb, permissions, requests_per_minute, search_reranker, embedding_provider, embedding_model, embedding_base_url, embedding_dims, models, update_check, skill_hint, search_stemmers.cyrillic, search_stemmers.latin. |
| `value` | required | a number, true or false; for a group tg:work,max:Alice,email:me@x. |

| Option | What it does |
|---|---|
| `--defaults` | change what every profile gets, rather than this profile. |

**Returns:** save a setting to the configuration file

**Example:** `beeline personal config set limit 20`

### `beeline config unset`

remove a setting from the configuration file

**Changes something on this computer only.**

```sh
beeline config unset <setting> [options]
```

| Argument | | What it is |
|---|---|---|
| `setting` | required | one of: limit, timeout_ms, color, record, record_input, keep_runs_for_days, keep_successful_runs_for_days, runs_size_limit_mb, permissions, requests_per_minute, search_reranker, embedding_provider, embedding_model, embedding_base_url, embedding_dims, models, update_check, skill_hint, search_stemmers.cyrillic, search_stemmers.latin. |

| Option | What it does |
|---|---|
| `--defaults` | change what every profile gets, rather than this profile. |

**Returns:** remove a setting from the configuration file

**Example:** `beeline personal config unset limit`

### `beeline config migrate`

write each setting the file lacks at its default, keeping yours

**Changes something on this computer only.**

```sh
beeline config migrate
```

**Returns:** write each setting the file lacks at its default, keeping yours

**Example:** `beeline config migrate`

### `beeline config repair`

fix broken JSON syntax in the settings file — comments, a missing or extra comma, unquoted keys, single quotes, missing closing brackets at the end — keeping every value, with a backup beside it; refuses anything with more than one reading and changes nothing then

**Changes something on this computer only.**

```sh
beeline config repair [options]
```

| Option | What it does |
|---|---|
| `--dry-run` | say what it would fix, and change nothing. |

**Returns:** fix the settings file's JSON syntax, keeping every value

**Example:** `beeline config repair`, `beeline config repair --dry-run`

## `beeline runs`

recorded runs — what this tool did, and when

### `beeline runs list`

recorded runs, newest first

```sh
beeline runs list [query] [options]
```

| Argument | | What it is |
|---|---|---|
| `query` | optional | field:value terms that narrow the list — the fields are below. |

| Option | What it does |
|---|---|
| `--limit <n>` | how many to show. Default: `20`. |
| `--page <n>` | which page, starting at 1. Default: `1`. |

**Returns:** run — run_id, command, started_at, status, cli_version, profile, completed_at, requests, and 23 more; every field: beeline commands info runs list

**Example:** `beeline personal runs list --limit 10`

### `beeline runs show`

one run: what it was, how it ended, and every event it logged

```sh
beeline runs show <run-id> [options]
```

| Argument | | What it is |
|---|---|---|
| `run-id` | required | an id from `beeline runs list`. |

| Option | What it does |
|---|---|
| `--problems` | only failed responses, warnings and crashes. |

**Returns:** run details — run_id, command, started_at, status, cli_version, directory, event_count, events, and 22 more; every field: beeline commands info runs show

**Example:** `beeline personal runs show run-101`

### `beeline runs path`

the directory holding one run

```sh
beeline runs path <run-id>
```

| Argument | | What it is |
|---|---|---|
| `run-id` | required | an id from `beeline runs list`. |

**Returns:** run location — path; every field: beeline commands info runs path

**Example:** `beeline personal runs path run-101`

## Exit codes

Branch on the code, not on the text: the text can change, the code does not.

| Code | When |
|---|---|
| `0` | it worked |
| `2` | `validation_error` |
| `3` | `configuration_error` |
| `4` | `authentication_error` |
| `5` | `permission_error` |
| `6` | `not_found` |
| `7` | `confirmation_required` |
| `8` | `rate_limited` |
| `9` | `timeout` |
| `10` | `network_error` |
| `11` | `provider_error` |
| `12` | `provider_unavailable` |
| `13` | `invalid_response` |
| `14` | `outcome_unknown` |
| `15` | `conflict` |
| `130` | `cancelled` |
| `1` | anything else |
