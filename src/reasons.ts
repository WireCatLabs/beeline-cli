import { defineReasons } from "@wirecat/cli-base/standards"
import { CORE_REASONS } from "@wirecat/cli-core"

/** cli-core's registry refuses a reason listed twice, and a reason it already has is its own to describe. */
const CORE = new Set(CORE_REASONS.map((one) => one.reason))

/** beeline's own reasons; the shared ones, `offline.refused` among them, are cli-core's and cli-base's. */
const OWN: [reason: string, code: string, message: string][] = [
  ["profile.not-signed-in", "authentication_error", "this profile has no Beeline API token; sign in first"],
  ["token.refused", "authentication_error", "Beeline refused the API token"],
  ["recording.empty", "provider_error", "Beeline sent an empty recording"],
  ["recording.too-large", "validation_error", "the recording is larger than 256 MB"],
  ["recording.not-stereo", "invalid_response", "the recording is not two separate channels"],
  ["model.not-downloaded", "not_found", "the speech model is not on this computer; download it first"],
]

export const REASONS = defineReasons(
  OWN.filter(([reason]) => !CORE.has(reason)).map(([reason, code, message]) => ({
    reason,
    code,
    message,
    details: [],
  })),
)
