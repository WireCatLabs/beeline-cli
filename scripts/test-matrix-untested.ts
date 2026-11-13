const SHARED_MEETINGS =
  "cli-core's shared meetings command, tested in cli-core's src/meetings/cli; beeline supplies only the store and the call source (src/calls.test.ts)"

const SHARED_MCP =
  "cli-core's appMcpCommand, tested in cli-core; beeline supplies only the instructions and signedIn (src/mcp.test.ts)"
const SHARED_CORE = "cli-core's shared command or flag, tested in cli-core; beeline adds nothing to it"

export const UNTESTED: { command: string; option?: string; reason: string }[] = [
  {
    command: "",
    option: "--help-all",
    reason: "Commander answers before any command runs, so the trace never sees it; contracts/help.snap covers help",
  },
  {
    command: "",
    option: "--version",
    reason: "Commander answers before any command runs, so the trace never sees it; `pnpm version:check` checks it",
  },
  {
    command: "mcp server start",
    reason:
      "starts a detached `mcp serve --http` from the built entry; cli-core tests mcpServerCommand, and the background run was checked by hand against dist/",
  },
  {
    command: "mcp server start",
    option: "--port",
    reason:
      "starts a detached `mcp serve --http` from the built entry; cli-core tests mcpServerCommand, and the background run was checked by hand against dist/",
  },
  {
    command: "mcp server start",
    option: "--public-url",
    reason:
      "starts a detached `mcp serve --http` from the built entry; cli-core tests mcpServerCommand, and the background run was checked by hand against dist/",
  },
  {
    command: "mcp server stop",
    reason:
      "starts a detached `mcp serve --http` from the built entry; cli-core tests mcpServerCommand, and the background run was checked by hand against dist/",
  },
  { command: "meetings list", option: "--jsonl", reason: SHARED_MEETINGS },
  { command: "meetings list", option: "--limit", reason: SHARED_MEETINGS },
  { command: "meetings list", option: "--page", reason: SHARED_MEETINGS },
  { command: "meetings show", reason: SHARED_MEETINGS },
  { command: "meetings show", option: "--json", reason: SHARED_MEETINGS },
  { command: "meetings show", option: "--jsonl", reason: SHARED_MEETINGS },
  { command: "meetings transcript", reason: SHARED_MEETINGS },
  { command: "meetings transcript", option: "--history", reason: SHARED_MEETINGS },
  { command: "meetings transcript", option: "--json", reason: SHARED_MEETINGS },
  { command: "meetings transcript", option: "--jsonl", reason: SHARED_MEETINGS },
  { command: "meetings export", reason: SHARED_MEETINGS },
  { command: "meetings export", option: "--format", reason: SHARED_MEETINGS },
  { command: "meetings export", option: "--transcript-id", reason: SHARED_MEETINGS },
  { command: "meetings export", option: "--output", reason: SHARED_MEETINGS },
  { command: "meetings export", option: "--json", reason: SHARED_MEETINGS },
  { command: "meetings export", option: "--jsonl", reason: SHARED_MEETINGS },
  { command: "meetings people", option: "--jsonl", reason: SHARED_MEETINGS },
  { command: "meetings people", option: "--limit", reason: SHARED_MEETINGS },
  { command: "meetings people", option: "--scan-limit", reason: SHARED_MEETINGS },
  { command: "meetings people", option: "--max-read-bytes", reason: SHARED_MEETINGS },
  { command: "meetings people", option: "--cursor", reason: SHARED_MEETINGS },
  { command: "meetings sync", option: "--jsonl", reason: SHARED_MEETINGS },
  { command: "events list", reason: SHARED_MEETINGS },
  { command: "events list", option: "--json", reason: SHARED_MEETINGS },
  { command: "events list", option: "--jsonl", reason: SHARED_MEETINGS },
  {
    command: "models download",
    reason:
      "cli-core's shared model catalogue downloads hundreds of MB from the model's pinned address; cli-core tests it",
  },
  {
    command: "models download",
    option: "--offline",
    reason:
      "cli-core's shared model catalogue downloads hundreds of MB from the model's pinned address; cli-core tests it",
  },
  {
    command: "models download",
    option: "--accept-terms",
    reason:
      "cli-core's shared model catalogue downloads hundreds of MB from the model's pinned address; cli-core tests it",
  },
  { command: "mcp serve", option: "--permission", reason: SHARED_MCP },
  { command: "mcp serve", option: "--profiles", reason: SHARED_MCP },
  { command: "mcp serve", option: "--http", reason: SHARED_MCP },
  { command: "mcp serve", option: "--port", reason: SHARED_MCP },
  { command: "mcp serve", option: "--public-url", reason: SHARED_MCP },
  { command: "mcp revoke", reason: SHARED_MCP },
  { command: "mcp revoke", option: "--profiles", reason: SHARED_MCP },
  { command: "mcp server status", reason: SHARED_MCP },
  { command: "mcp server status", option: "--profiles", reason: SHARED_MCP },
  { command: "mcp config", reason: SHARED_MCP },
  { command: "mcp config", option: "--permission", reason: SHARED_MCP },
  { command: "mcp config", option: "--profiles", reason: SHARED_MCP },
  { command: "mcp add", reason: SHARED_MCP },
  { command: "mcp add", option: "--allow-writes", reason: SHARED_MCP },
  { command: "mcp add", option: "--permission", reason: SHARED_MCP },
  {
    command: "mcp check",
    reason:
      "starts `mcp serve` as a child process from the built entry, which vitest cannot; signed_in was checked by hand against dist/ with and without BEELINE_TOKEN",
  },
  { command: "mcp check", option: "--permission", reason: SHARED_MCP },
  { command: "meetings repair", reason: SHARED_MEETINGS },
  { command: "meetings repair", option: "--json", reason: SHARED_MEETINGS },
  { command: "meetings repair", option: "--jsonl", reason: SHARED_MEETINGS },
  { command: "meetings repair", option: "--yes", reason: SHARED_MEETINGS },
  { command: "doctor", option: "--online", reason: SHARED_CORE },
  { command: "config migrate", reason: SHARED_CORE },
  { command: "config repair", reason: SHARED_CORE },
  { command: "config repair", option: "--dry-run", reason: SHARED_CORE },
  { command: "", option: "--compact", reason: SHARED_CORE },
  { command: "doctor reports show", reason: SHARED_CORE },
  { command: "doctor reports create", reason: SHARED_CORE },
  { command: "doctor reports create", option: "--run", reason: SHARED_CORE },
  { command: "doctor reports create", option: "--output", reason: SHARED_CORE },
  { command: "complete", reason: SHARED_CORE },
  { command: "search meetings", option: "--meeting-id", reason: SHARED_MEETINGS },
  { command: "search meetings", option: "--identity-id", reason: SHARED_MEETINGS },
  { command: "search meetings", option: "--person-id", reason: SHARED_MEETINGS },
  { command: "search meetings", option: "--event-id", reason: SHARED_MEETINGS },
  { command: "search meetings", option: "--series-id", reason: SHARED_MEETINGS },
  { command: "search meetings", option: "--project", reason: SHARED_MEETINGS },
  { command: "search meetings", option: "--tag", reason: SHARED_MEETINGS },
  { command: "search meetings", option: "--topic-name", reason: SHARED_MEETINGS },
  { command: "search meetings", option: "--since-time", reason: SHARED_MEETINGS },
  { command: "search meetings", option: "--until-time", reason: SHARED_MEETINGS },
  { command: "search meetings", option: "--limit", reason: SHARED_MEETINGS },
  { command: "search meetings", option: "--cursor", reason: SHARED_MEETINGS },
  { command: "search meetings", option: "--max-read-bytes", reason: SHARED_MEETINGS },
]
