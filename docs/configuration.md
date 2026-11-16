# Settings

Settings live in one file, `config.json`, in the folder `beeline doctor` shows. Each profile has its own part,
and `defaults` apply to every profile. This page lists how to see and change them.

```sh
beeline work config show
beeline work config set limit 50
beeline work config unset limit
```

`config show` lists each setting and where it came from: the file, a variable or the default.

## Permissions

`permissions` decides what a command may do for this profile: `allow`, `ask`, `readonly` or `deny`, per permission
key. Over MCP there is no one to ask, so `ask` lets the command run. `BEELINE_READ_ONLY=1` refuses a change to the
sign-in, the settings, the agent setup or the stored meetings, whatever the permissions say. A sync still fetches new
calls into the store; the [README](../README.md#settings-and-permissions) lists what it refuses and lets through.

## Recordings

`keep_recordings` decides whether `meetings transcribe` keeps each call's recording on this computer after it is
transcribed, readable only by you, so WireCat Desktop plays it and `meetings show` names its file. It is `true`
unless you set it to `false` on the profile (`beeline work config set keep_recordings false`); then each recording is
dropped once transcribed. A file kept before stays until you delete it.

## Run records

A command that fails is kept as a run, for `beeline runs list` and `runs show`. `record_input` decides whether a run
keeps the words you typed; it is `true` unless you set it to `false`. Secrets are masked either way; see
[Security](security.md).
