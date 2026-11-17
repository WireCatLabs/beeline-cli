import type { FetchLike } from "@wirecat/cli-base/http"
import { BASE_URL } from "../beeline-api.js"

/**
 * The requests Beeline's API documentation names (docs/dev/DESIGN.md, "The API"): `GET records` with `id`, `userId`,
 * `dateFrom` and `dateTo`, and `GET v2/records/{recordId}/download`, each with the token header. The documentation
 * gives no error body for an unknown path or parameter, so the fake answers with the status alone.
 */
const RECORDS_PARAMETERS = new Set(["id", "userId", "dateFrom", "dateTo"])
const DOWNLOAD = /^v2\/records\/[^/]+\/download$/

/** A fake Beeline that refuses what the documented API does not have, then lets `answer` reply. */
export const strictBeeline =
  (answer: (url: URL) => Response | Promise<Response>): FetchLike =>
  async (input, init = {}) => {
    const url = new URL(String(input))
    if ((init.method ?? "GET") !== "GET") return new Response(null, { status: 405 })
    if (!new Headers(init.headers).get("X-MPBX-API-AUTH-TOKEN")) return new Response(null, { status: 403 })
    const path = url.href.startsWith(BASE_URL) ? url.pathname.slice(new URL(BASE_URL).pathname.length) : undefined
    if (path === "records") {
      if ([...url.searchParams.keys()].some((name) => !RECORDS_PARAMETERS.has(name)))
        return new Response(null, { status: 400 })
    } else if (!path || !DOWNLOAD.test(path) || url.search !== "") return new Response(null, { status: 404 })
    return answer(url)
  }
