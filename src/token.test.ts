import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { brokenKeyring, memoryKeyring, systemKeyring } from "@wirecat/cli-base"
import { afterEach, describe, expect, it, vi } from "vitest"
import { tokens } from "./token.js"

const envHere = (): NodeJS.ProcessEnv => ({ BEELINE_CONFIG_DIR: mkdtempSync(join(tmpdir(), "beeline-config-")) })

describe("where the token is kept (WC-SECR-4)", () => {
  it("falls back to a private file without asking and warns once when the keyring fails", () => {
    const store = tokens(envHere(), brokenKeyring())
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)
    expect(store.write("work", "example-token")).toBe("file")
    expect(store.read("work")).toEqual({ secret: "example-token", source: "file" })
    const warnings = stderr.mock.calls.filter(([text]) => String(text).includes("could not reach the OS keyring"))
    stderr.mockRestore()
    expect(warnings).toHaveLength(1)
  })

  it("keeps the token in the file when asked, and a keyring sign-in moves it back", () => {
    const keyring = memoryKeyring()
    const store = tokens(envHere(), keyring)
    expect(store.write("work", "example-token-1")).toBe("keyring")
    expect(store.write("work", "example-token", "file")).toBe("file")
    expect(keyring.entries.size).toBe(0)
    expect(store.read("work")).toEqual({ secret: "example-token", source: "file" })
    expect(store.write("work", "example-token-2")).toBe("keyring")
    expect(store.read("work")).toEqual({ secret: "example-token-2", source: "keyring" })
  })
})

describe("a run with a throwaway HOME (WC-SECR-24)", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Credentials treats a run as moved only with the system keyring, so this stubs it in memory instead of memoryKeyring.
  const stubSystemKeyring = (saved: Record<string, string>) => ({
    set: vi.spyOn(systemKeyring, "set").mockImplementation((service, account, secret) => {
      saved[`${service}/${account}`] = secret
    }),
    delete: vi.spyOn(systemKeyring, "delete").mockImplementation((service, account) => {
      const existed = `${service}/${account}` in saved
      delete saved[`${service}/${account}`]
      return existed
    }),
    get: vi
      .spyOn(systemKeyring, "get")
      .mockImplementation((service, account) => saved[`${service}/${account}`] ?? null),
  })

  it("reads the owner's token but never writes or deletes the shared entry", () => {
    const saved: Record<string, string> = { "beeline-cli/token:work": "owner-token" }
    const keyring = stubSystemKeyring(saved)
    vi.spyOn(process.stderr, "write").mockImplementation(() => true)
    const store = tokens({ HOME: mkdtempSync(join(tmpdir(), "beeline-home-")) })

    expect(store.read("work")).toEqual({ secret: "owner-token", source: "keyring" })
    expect(store.write("work", "throwaway-token")).toBe("keyring")
    expect(store.read("work")).toEqual({ secret: "throwaway-token", source: "keyring" })
    store.write("work", "file-token", "file")
    expect(store.remove("work")).toEqual(["file"])

    const touched = [...keyring.set.mock.calls, ...keyring.delete.mock.calls].map(([service]) => service)
    expect(touched.length).toBeGreaterThan(0)
    expect(touched).not.toContain("beeline-cli")
    expect(saved["beeline-cli/token:work"]).toBe("owner-token")
  })
})
