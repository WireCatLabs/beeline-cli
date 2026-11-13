import { describeProgram } from "@wirecat/cli-base/commands"
import { changesAuthorityAt, readsOverMcpAt } from "@wirecat/cli-core/cli"
import { toolsFromCommands } from "@wirecat/cli-core/mcp"
import { ownCatalogue } from "@wirecat/cli-core/testing"
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

it("pins beeline's own commands an agent can find, and never offers a sign-in or account removal", async () => {
  const program = createProgram()
  const options = {
    includeUnavailable: true,
    exclude: [["mcp"]],
    authority: changesAuthorityAt(program),
    fetchOnly: readsOverMcpAt(program),
    permissions,
  }
  await expect(`${JSON.stringify(ownCatalogue(program, options), null, 2)}\n`).toMatchFileSnapshot(
    "../contracts/mcp-catalogue.json",
  )
  const offered = new Map(toolsFromCommands(describeProgram(program), options).map((tool) => [tool.command, tool]))
  for (const never of ["session start", "session end", "account remove"]) expect(offered.has(never)).toBe(false)
})
