import { defineSetup, type SetupCheck } from "@wirecat/cli-core/cli"
import { keptToken, provenToken } from "../commands/session.js"
import { configuration } from "../config.js"
import { IDENTITY } from "../identity.js"
import en from "./texts.en.json" with { type: "json" }
import es from "./texts.es.json" with { type: "json" }
import ru from "./texts.ru.json" with { type: "json" }

/** The proof `session start` runs. Editing a profile without a new token proves the kept one. */
const check: SetupCheck = async ({ command, secrets }) => {
  const token = await provenToken(command, () => secrets.token ?? keptToken(command))
  return secrets.token === undefined ? undefined : { keep: { secrets: { token } } }
}

export const beelineSetup = defineSetup({
  app: IDENTITY,
  configuration,
  check,
  start: "before",
  steps: {
    before: {
      title: "before.title",
      blocks: [
        { type: "text", text: "before.intro" },
        { type: "text", text: "before.needs" },
        { type: "note", role: "info", text: "before.recording" },
      ],
      next: "where",
    },
    where: {
      title: "where.title",
      blocks: [
        { type: "text", text: "where.steps" },
        { type: "code", code: "https://cloudpbx.beeline.ru/", copy: true },
        { type: "note", role: "warning", text: "where.secret" },
      ],
      next: "token",
    },
    token: {
      title: "token.title",
      blocks: [
        { type: "text", text: "token.paste" },
        { type: "input", id: "token", secret: "token", input: "password", label: "token.label", hint: "token.hint" },
      ],
      next: "check",
    },
    check: {
      kind: "run",
      title: "check.title",
      action: "apply",
      blocks: [{ type: "text", text: "check.body" }],
      next: [
        { when: { result: "check", is: "ok" }, to: "done" },
        { when: { result: "check", error: "authentication_error" }, to: "token" },
        { when: { result: "check", error: "validation_error" }, to: "token" },
        { to: "failed" },
      ],
      back: false,
    },
    failed: {
      kind: "done",
      title: "failed.title",
      blocks: [{ type: "note", role: "danger", text: "failed.body" }],
      back: true,
    },
    done: {
      kind: "done",
      title: "done.title",
      blocks: [
        { type: "text", text: "done.body" },
        { type: "code", code: "beeline <profile> meetings sync\nbeeline <profile> meetings transcribe", copy: true },
      ],
    },
  },
  texts: { en, ru, es },
})
