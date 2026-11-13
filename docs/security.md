# Security

What WireCat CLIs share — the keyring, permissions, MCP, run records and what never reaches a log — is on the
[shared security page](https://wirecat.dev/en/docs/security). This page keeps only what is particular to `beeline`.

## What it sends, and where

- `beeline` talks to one service: the Beeline Cloud PBX API at `cloudpbx.beeline.ru`, over HTTPS.
- It only reads: the list of recorded calls and each call's recording. The API can also delete recordings and place
  calls. `beeline` has no command that does either.
- `meetings sync`, `meetings transcribe`, `session start` and `session status --check` are the only commands that
  ask Beeline. `--offline` refuses them before any request. `models download` fetches a speech model from its own
  host, and sends nothing of yours.

## The API token

- The token comes from the Beeline cabinet: Услуги → Интеграция по API. Anyone who holds it can read and delete
  every recording of the PBX, so treat it like a password.
- `beeline work session start` reads it hidden or from stdin, checks it against Beeline, and only then keeps it in
  the system keyring. Where the keyring fails, it goes to a file only you can read, and `beeline` says so once.
  `BEELINE_TOKEN` in the environment is read before both.
- The token is sent only in the `X-MPBX-API-AUTH-TOKEN` request header. It never appears in a link, an error, a run
  record or the output. From what Beeline answers with an error, only its short error code is kept: its description
  can quote a phone number.
- `beeline work session end` forgets the token on this computer. The calls already synced stay.

## Recordings and speech

- A recording is downloaded into memory, transcribed and dropped. It is never written to disk. The store keeps only
  its size, its length and a hash, so a second run can tell the same recording.
- Speech is recognized on this computer, by a model that `beeline models download` fetches once into the folder every
  WireCat CLI shares. The recording and its transcript are sent to no speech service. A cloud option, such as OpenAI,
  is planned and not offered yet.

## What the store keeps

The calls go into the local WireCat store that the other WireCat CLIs on this computer share, so their `search all`
finds them too. For each call it keeps:

- the time, the direction and the duration;
- the manager: name, email and extension, and Beeline's id for them, which holds the manager's phone number;
- the client's phone number;
- the transcript, once `meetings transcribe` made one.

Treat the store as you treat the calls themselves. `beeline` never prints a phone number in a log or a run record; a
command's answer is where a call you asked for is allowed to appear.

## On this computer

`config.json` is saved readable by you only (`0600`), and its folder is created for you only (`0700`).
`beeline doctor` lists a file or folder that other users can read under `files.problems`, with the `chmod` that fixes
it. Windows is not checked.

`beeline work mcp serve --http` listens on `127.0.0.1` only. `beeline work mcp revoke` ends every login it
gave.

Report a vulnerability as [SECURITY.md](https://github.com/WireCatLabs/beeline-cli/blob/main/SECURITY.md) says.
