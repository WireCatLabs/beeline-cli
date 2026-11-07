import { mcpOverStdio } from "@wirecat/cli-core/testing"
import { run } from "../program.js"

export const mcpClient = (profile = "personal", flags: string[] = []) =>
  mcpOverStdio((streams) =>
    run([profile, "mcp", "serve", ...flags], {
      tty: false,
      streams: { data: () => {}, diagnostic: () => {} },
      ...streams,
    }),
  )
