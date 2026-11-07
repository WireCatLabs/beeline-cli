import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, expect, it, vi } from "vitest"
import { run } from "./program.js"
import { mcpClient } from "./testing/mcp.js"

const ran = async (argv: string[], fetch?: unknown) => {
  const err: string[] = []
  const code = await run(argv, {
    streams: { data: () => {}, diagnostic: (text) => err.push(text) },
    tty: false,
    ...(fetch ? { fetch } : {}),
  } as Parameters<typeof run>[1])
  return { code, err: err.join("\n") }
}

afterEach(() => {
  delete process.env.BEELINE_TOKEN
  rmSync(join(process.env.BEELINE_CONFIG_DIR ?? "", "config.json"), { force: true })
})

it("a deny in the profile stops a read before any request to Beeline", async () => {
  process.env.BEELINE_TOKEN = "test-token"
  const fetch = vi.fn(async () => Response.json([]))
  const dir = process.env.BEELINE_CONFIG_DIR ?? ""
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, "config.json"),
    JSON.stringify({ profiles: { work: { permissions: { "meetings.sync": "deny", "meetings.list": "deny" } } } }),
  )

  const synced = await ran(["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z", "--json"], fetch)
  expect(synced.code).toBe(5)
  expect(synced.err).toContain("permission_error")
  expect((await ran(["work", "meetings", "list", "--json"], fetch)).code).toBe(5)
  expect(fetch).not.toHaveBeenCalled()
})

it("over MCP a denied command is listed as unavailable and refused", async () => {
  const dir = process.env.BEELINE_CONFIG_DIR ?? ""
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, "config.json"),
    JSON.stringify({ profiles: { work: { permissions: { "meetings.list": "deny" } } } }),
  )
  const mcp = await mcpClient("work")
  try {
    const found = await mcp.call("beeline_tools_search", { query: "meetings list" })
    expect((found.body as { items: unknown[] }).items).toContainEqual(
      expect.objectContaining({
        command: "meetings list",
        availability: expect.objectContaining({ available: false }),
      }),
    )
    const answer = await mcp.call("beeline_read", { command: "meetings list" })
    expect(answer.isError).toBe(true)
    expect(JSON.stringify(answer.body)).toContain("permission_error")
  } finally {
    await mcp.close()
  }
})

it.each([
  [["work", "session", "start"]],
  [["work", "session", "status", "--check"]],
  [["work", "meetings", "sync", "--since-time", "2026-10-01T00:00:00Z"]],
  [["work", "meetings", "transcribe"]],
])("--offline refuses %j before any request to Beeline", async (argv) => {
  process.env.BEELINE_TOKEN = "test-token"
  const fetch = vi.fn(async () => Response.json([]))
  const refused = await ran(["--offline", ...argv, "--json"], fetch)
  expect(refused.code).toBe(5)
  expect(refused.err).toContain("offline.refused")
  expect(fetch).not.toHaveBeenCalled()
})
