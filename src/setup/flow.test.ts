import { Readable } from "node:stream"
import { type KeyringStore, memoryKeyring } from "@wirecat/cli-base"
import type { FetchLike } from "@wirecat/cli-base/http"
import { setupProblems } from "@wirecat/cli-core/cli"
import { setupFileProblems } from "@wirecat/cli-core/testing"
import { describe, expect, it, vi } from "vitest"
import { configuration } from "../config.js"
import { run } from "../program.js"
import { strictBeeline } from "../testing/fake-beeline.js"
import { beelineSetup } from "./flow.js"
import en from "./texts.en.json" with { type: "json" }
import es from "./texts.es.json" with { type: "json" }
import ru from "./texts.ru.json" with { type: "json" }

const GOOD = "good-token"

const accepting = (): FetchLike =>
  vi.fn(async (input: Parameters<FetchLike>[0], init?: Parameters<FetchLike>[1]) => {
    const token = new Headers(init?.headers).get("X-MPBX-API-AUTH-TOKEN")
    return strictBeeline(() => (token === GOOD ? Response.json([]) : new Response("{}", { status: 403 })))(input, init)
  }) as unknown as FetchLike

const ran = async (argv: string[], options: { keyring: KeyringStore; stdin?: string; fetch?: FetchLike }) => {
  const out: string[] = []
  const err: string[] = []
  const code = await run(argv, {
    streams: { data: (text) => out.push(text), diagnostic: (text) => err.push(text) },
    tty: false,
    keyring: options.keyring,
    fetch: options.fetch ?? accepting(),
    ...(options.stdin === undefined ? {} : { stdin: Readable.from([options.stdin]) }),
  })
  const error = err.join("").includes('{"error"')
    ? JSON.parse(err.join("").slice(err.join("").lastIndexOf('{"error"'))).error
    : undefined
  return { code, out: out.join("\n"), error, json: () => JSON.parse(out.join("\n")) }
}

const apply = (answers: Record<string, unknown>, keyring: KeyringStore = memoryKeyring(), argv: string[] = []) =>
  ran(["work", "setup", "run", "apply", "--json", "--answer-stdin", ...argv], {
    keyring,
    stdin: `${JSON.stringify(answers)}\n`,
  })

const status = async (keyring: KeyringStore) =>
  (await ran(["work", "session", "status", "--json"], { keyring })).json().item

describe("the setup flow", () => {
  it("**is a valid v1 document** over beeline's own settings, with no image files", () => {
    expect(setupProblems(beelineSetup.document, { settings: configuration.allSettings, v1: true })).toEqual([])
    expect(setupFileProblems(beelineSetup, new URL("../../", import.meta.url))).toEqual([])
  })

  it("**has every text in Russian and Spanish too**", () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort())
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
  })

  it("**the Russian texts read as plain Russian**: no officialese and no English words but names", () => {
    const text = Object.values(ru).join("\n")
    expect(text).not.toMatch(/является|данн(ый|ая|ое|ые)|осуществля|позволяет|необходимо|следует/i)
    const english = text.replace(/https:\/\/\S+|`[^`]*`|Beeline|WireCat|API|beeline/g, "").match(/[A-Za-z]{3,}/g)
    expect(english).toBeNull()
  })

  it("**keeps a token Beeline accepts, as session start does**, and prints no token", async () => {
    const keyring = memoryKeyring()
    const saved = await apply({ token: GOOD }, keyring)
    expect([saved.code, saved.error]).toEqual([0, undefined])
    expect(saved.json()).toMatchObject({ item: { outcome: "ok", secrets: ["token"] } })
    expect(saved.out).not.toContain(GOOD)
    expect(await status(keyring)).toMatchObject({ state: "saved", token_from: "keyring" })
    const shown = await ran(["work", "setup", "show", "--json"], { keyring })
    expect(shown.json()).toMatchObject({ item: { values: { token: { set: true } } } })
  })

  it("**a token Beeline refuses keeps nothing**", async () => {
    const keyring = memoryKeyring()
    const refused = await apply({ token: "wrong" }, keyring)
    expect(refused.code).not.toBe(0)
    expect(refused.error).toMatchObject({ code: "authentication_error" })
    expect(await status(keyring)).toMatchObject({ state: "missing" })
  })

  it("**editing a profile without a new token proves the kept one**", async () => {
    const keyring = memoryKeyring()
    await apply({ token: GOOD }, keyring)
    const edited = await apply({}, keyring)
    expect([edited.code, edited.error]).toEqual([0, undefined])
  })

  it("**refuses no token, offline, and a profile named as a command, as session start does**", async () => {
    const empty = await apply({ token: "   " })
    expect(empty.error).toMatchObject({ code: "validation_error" })
    const offline = await apply({ token: GOOD }, memoryKeyring(), ["--offline"])
    expect(offline.code).not.toBe(0)
    const named = await ran(["meetings", "setup", "run", "apply", "--json", "--answer-stdin"], {
      keyring: memoryKeyring(),
      stdin: `${JSON.stringify({ token: GOOD })}\n`,
    })
    expect(named.code).not.toBe(0)
  })

  it("**apply --dry-run saves nothing; apply saves as run apply does**", async () => {
    const keyring = memoryKeyring()
    const dry = await ran(["work", "setup", "apply", "--dry-run", "--json"], {
      keyring,
      stdin: JSON.stringify({ token: GOOD }),
    })
    expect(dry.json()).toMatchObject({ item: { valid: true, complete: true } })
    expect(await status(keyring)).toMatchObject({ state: "missing" })
    const saved = await ran(["work", "setup", "apply", "--json"], { keyring, stdin: JSON.stringify({ token: GOOD }) })
    expect(saved.json()).toMatchObject({ item: { outcome: "ok", secrets: ["token"] } })
    expect(await status(keyring)).toMatchObject({ state: "saved" })
  })
})
