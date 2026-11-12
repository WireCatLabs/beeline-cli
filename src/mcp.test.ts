import { describeProgram } from "@wirecat/cli-base/commands"
import { changesAuthorityAt, readsOverMcpAt } from "@wirecat/cli-core/cli"
import { toolsFromCommands } from "@wirecat/cli-core/mcp"
import { expect, it } from "vitest"
import { permissions } from "./config.js"
import { createProgram } from "./program.js"
import { mcpClient } from "./testing/mcp.js"

it("serves search, read and write over every command but mcp, and runs a command through the CLI", async () => {
  const mcp = await mcpClient()
  try {
    expect((await mcp.tools()).sort()).toEqual(["beeline_read", "beeline_tools_search", "beeline_write"])
    const found = await mcp.call("beeline_tools_search", {})
    const items = (found.body as { items: { command: string; writes: boolean }[] }).items
    expect(items).toContainEqual(expect.objectContaining({ writes: true }))
    expect(items.map((item) => item.command)).not.toContainEqual(expect.stringMatching(/^mcp\b/))
    const doctor = await mcp.call("beeline_read", { command: "doctor" })
    expect(doctor.body).toMatchObject({ item: { version: expect.any(String), profiles: [] } })
  } finally {
    expect(await mcp.close()).toBe(0)
  }
})

// Only beeline's own groups: the commands cli-core mounts are cli-core's to pin, and pinning them here turns every
// cli-core release into an adoption change.
const OWN_GROUPS = ["session", "meetings", "events", "models"]

it("pins beeline's own commands an agent can find, and never offers a sign-in or account removal", async () => {
  const program = createProgram()
  const tools = toolsFromCommands(describeProgram(program), {
    includeUnavailable: true,
    exclude: [["mcp"]],
    authority: changesAuthorityAt(program),
    fetchOnly: readsOverMcpAt(program),
    permissions,
  })
  const catalogue = Object.fromEntries(
    tools
      .filter((tool) => OWN_GROUPS.includes(tool.command.split(" ")[0] ?? ""))
      .map((tool) => [tool.command, tool.writes ? "write" : "read"]),
  )
  await expect(`${JSON.stringify(catalogue, null, 2)}\n`).toMatchFileSnapshot("../contracts/mcp-catalogue.json")
  const offered = tools.map((tool) => tool.command)
  for (const never of ["session start", "session end", "account remove"]) expect(offered).not.toContain(never)
})
