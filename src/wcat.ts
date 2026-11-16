import type { ManifestIdentity } from "@wirecat/cli-base/wcat/manifest"
import { PROVIDER_NAME } from "./call-source.js"
import { permissions } from "./config.js"
import { DESKTOP } from "./identity.js"

export const WCAT: ManifestIdentity = { ...DESKTOP, meetingsProvider: PROVIDER_NAME, permissionOf: permissions.keyOf }
