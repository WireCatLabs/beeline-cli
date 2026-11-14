import { syncAfterInstallCases } from "@wirecat/cli-core/testing"
import { describe, it } from "vitest"
import { run } from "./program.js"
import { record } from "./testing/records.js"

describe("sync runs right after install, whatever the shared WireCat config holds", () => {
  for (const one of syncAfterInstallCases({
    sync: ["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z"],
    profileLevels: { variable: "BEELINE_CONFIG_DIR", keys: ["meetings"] },
    run: async (argv, env) => {
      const err: string[] = []
      const code = await run(argv, {
        streams: { data: () => {}, diagnostic: (text) => err.push(text) },
        tty: false,
        fetch: async () => Response.json([record(1)]),
        env: { ...process.env, BEELINE_TOKEN: "test-token", ...env },
      })
      return { code, err: err.join("\n") }
    },
  }))
    it(one.name, () => one.run())
})
