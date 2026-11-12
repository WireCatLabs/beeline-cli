import type { ManifestIdentity } from "@wirecat/cli-base/wcat/manifest"
import type { AppIdentity } from "@wirecat/cli-core/cli"
import { REASONS } from "./reasons.js"
import { VERSION } from "./version.js"

export const PACKAGE = "@wirecat/beeline-cli"

export const IDENTITY: AppIdentity = {
  command: "beeline",
  appName: "beeline-cli",
  envPrefix: "BEELINE",
  description: "Beeline Cloud PBX call recordings as meetings: sync, transcribe on this computer, search and export",
  version: VERSION,
  issues: "https://github.com/WireCatLabs/beeline-cli/issues/new",
  messenger: false,
  contentLanguages: ["ru"],
  errors: { reasons: REASONS },
}

// The bin hands this to wcatStart before the program loads, so it must not import the command tree; src/wcat.ts adds
// the permission keys for the manifest.
export const DESKTOP: ManifestIdentity & { hosts: readonly string[] } = {
  ...IDENTITY,
  docs: "https://github.com/WireCatLabs/beeline-cli#readme",
  tagline: "Beeline Cloud PBX calls, transcribed on your computer",
  syncs: "recorded calls",
  signIn: {
    gives: "Lets your agent read the recorded calls of your Beeline Cloud PBX, transcribed on this computer.",
    asks: "A Beeline Cloud PBX API token, from the Beeline cabinet: Услуги → Интеграция по API.",
  },
  hosts: ["cloudpbx.beeline.ru"],
}

export const SKILL = new URL("../skills/beeline-cli/SKILL.md", import.meta.url)
