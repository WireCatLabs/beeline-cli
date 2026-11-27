import { defineReasons } from "@wirecat/cli-base/standards"
import { CORE_REASONS } from "@wirecat/cli-core"

/** cli-core's registry refuses a reason listed twice, and a reason it already has is its own to describe. */
const CORE = new Set(CORE_REASONS.map((one) => one.reason))

/** beeline's own reasons; the shared ones, `offline.refused` among them, are cli-core's and cli-base's. */
const OWN: [reason: string, code: string, message: string, details?: string[]][] = [
  ["token.refused", "authentication_error", "Beeline refused the API token"],
  ["recording.empty", "provider_error", "Beeline sent an empty recording"],
  ["recording.too-large", "validation_error", "the recording is larger than 2 GB"],
  [
    "recording.too-long",
    "validation_error",
    "the call is longer than 60 minutes, the longest meetings transcribe takes",
  ],
  ["recording.not-stereo", "invalid_response", "the recording is not two separate channels"],
  ["model.not-downloaded", "not_found", "the speech model is not on this computer; download it first"],
  ["transcript.missing", "not_found", "the call has no transcript yet; meetings transcribe makes one", ["meeting"]],
  [
    "transcript.too-short",
    "not_found",
    "the call is shorter than five seconds, so meetings transcribe skips it",
    ["meeting"],
  ],
]

export const REASONS = defineReasons(
  OWN.filter(([reason]) => !CORE.has(reason)).map(([reason, code, message, details = []]) => ({
    reason,
    code,
    message,
    details,
  })),
)
