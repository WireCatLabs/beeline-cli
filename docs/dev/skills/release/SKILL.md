---
name: release
description: Release this CLI — run release:check, check the changelog fragments and the docs against what changed, run the fresh audit, then hand over to the owner, who raises the version, runs the live check and publishes with bin/owner-release. Release a batch of changes, not every merge. Use when asked to release, prepare a release, cut a version, «выпуск», «выпустить версию».
---

# Release

The rules are the handbook's [Releases page](../../../../node_modules/@wirecat/cli-base/docs/standards/releases.md)
(`WC-REL-<n>`), which wins over this skill. An agent prepares the release: steps 1 to 6, in the pull requests it
merges. The owner publishes beeline by hand: `bin/owner-release <profile>` raises the version, runs the live check,
merges the release pull request and runs `bin/release --local` (steps 7 to 10). An agent never raises the version or
runs `bin/release`. Release a batch of changes, not every merge.

1. **What changed.** In a worktree off `origin/main`: `git log --oneline "$(git describe --tags --abbrev=0 origin/main)..origin/main"`. The
   `docs/commands.md` diff shows what a cli-core or cli-base release changed in the commands.
2. **The checks.** `pnpm release:check`. Before the version is raised, only the changelog's `## Unreleased` may be
   left; report anything else and fix it in the release pull request.
3. **The changelog.** Write `## Unreleased` under the handbook's headings, each at most once: `Added`,
   `Changed — may break callers`, `Fixed`, `Security`, `Removed` (`WC-DOC-14` to `WC-DOC-18`). No internal ids.
   The `changes/` fragments count too: `bin/release` collects them into the version's section.
4. **The docs.** `README.md`, `docs/*.md` and `skills/beeline-cli/SKILL.md` state what the code does now (`WC-DOC-3`).
   `pnpm generate` and `pnpm test:matrix` rewrite the generated pages (`WC-DOC-4`).
5. **The comparison page.** Re-prove each ✅, 🟡 and ❌ this CLI has on its comparison page against the release build
   (`WC-CMP-11`): the site copy in cli-docs, `translations/pages/beeline/compare.en.md` and its `.ru.md` and `.es.md`,
   or this repository's `docs/compare.md` where it keeps one. Update the check date and version in the intro, in the
   site repository, and name the page in the release pull request.
6. **The fresh audit.** Start a new subagent that has none of your context, and give it the prompt in
   [fresh-audit.md](fresh-audit.md) as written. Put its report in the release pull request. Fix each gap in this
   repository there, or list it as a follow-up; take a gap in the handbook to cli-base.
7. **The hand-over.** Tell the owner the release is ready, with the fresh audit's report and what it found, and the
   command: `bin/owner-release <profile>` in the main checkout. Leave the version in `package.json` as npm has it.
8. **The owner's release.** `bin/owner-release <profile>`, one Ruby file that prints each step before it runs it:
   - checks that main is clean, fast-forwards it to origin/main, and that the released WireCat Desktop reads this
     manifest;
   - `pnpm install --frozen-lockfile`;
   - raises the version: dates the changelog section, collects `changes/` into it, picks the level its headings need
     (before `1.0.0` an `Added`, `Changed — may break callers` or `Removed` raises the minor, else the patch;
     `scripts/version-level.ts`), and runs `pnpm version:sync`. A version raised and dated by hand is kept;
   - `pnpm build`, then the read-only live check of Beeline on that build, in a throwaway home, store and XDG folders,
     with `DBUS_SESSION_BUS_ADDRESS=disabled:` on the beeline runs only (`WC-TEST-18`): session, a week's sync, a
     list, one transcription, and its recording kept with mode `0600`. It prints counts and field names only;
   - `cli-dev live record --script bin/owner-release` appends the check to `docs/dev/live-checks.txt`;
   - opens `chore(release): <version>` with the version and the record and a `## Conformance` section, waits for its
     checks, and squash merges it. The record rides in the release commit, so no second pull request is needed;
     `bin/release` refuses a version with no line, or whose `src/`, `package.json` or lockfile differ from the hashed
     ones (`WC-REL-17`);
   - runs `bin/release --local`, which runs `pnpm release:check` and the local validation, publishes, tags and makes
     the GitHub release (`WC-REL-11`, `WC-REL-13`).

   On success the last line is `published @wirecat/beeline-cli@<version>`. A failed live check leaves main as it was
   and pushes nothing. The npm token is `NPM_TOKEN`, or the keyring entry `NPM_KEYRING_ACCOUNT` names (service `npm`),
   or the owner's npm login; there is no default account.
9. **After the release.** Raise `contracts/previous/` and `contracts/upgrade.json` to the version just published, in
   the next pull request.
