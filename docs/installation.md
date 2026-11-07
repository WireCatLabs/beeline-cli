# Install

Install `beeline` once on each computer where you or an agent use it. You need Node.js 22.16 or a later 22.x, or 24 or later; Node 23 is not supported.

`beeline` is private and is not published to npm. Install it from a clone of its GitHub repository:

```sh
git clone https://github.com/WireCatLabs/beeline-cli.git
cd beeline-cli
pnpm install
pnpm build
npm install -g .
beeline --version
```

Check the installation, then pick a profile name for your account, such as `personal`:

```sh
beeline doctor
```

`doctor` needs no network and opens no keyring. It shows the version, where settings live, the profiles that
exist, and whether other users of the computer can read the settings. Next: [use it](usage.md).
