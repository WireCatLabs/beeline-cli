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

export const SKILL = new URL("../skills/beeline-cli/SKILL.md", import.meta.url)
