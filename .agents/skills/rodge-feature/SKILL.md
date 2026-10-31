---
name: rodge-feature
description: The end-to-end workflow for building a Rodge Mail feature or fix in a T3 Code worktree, from planning through simulator and browser verification, PR evidence, CI, and merging it yourself (Shawn does not review PRs). Use at the start of any feature, bug fix, or UI change in this repo, and whenever you need screenshots or videos for a PR, touch Convex functions, or are about to open or merge a PR. Simulator and emulator use also requires the rodge-simulator skill.
---

# Building a Rodge Mail change

Shawn opens one T3 Code thread and worktree per change
(`~/.t3/worktrees/rodge-mail/<name>`). `t3.json` already ran
`scripts/worktree-setup.sh` (local env files, this worktree's
`shared/config` overrides, dependencies). You own this worktree and its
branch: T3 names the branch, so don't rename it, and never touch another
worktree.

## 1. Understand and plan

Read `AGENTS.md`, then the docs for the area you're changing (`docs/`,
`services/convex/*.md`, package READMEs, `.notes/`). If the request is
ambiguous in a way that changes what you build, ask before building.
Otherwise pick the sensible default and say so in the PR.

**Fixing a GitHub issue.** Read it first (`gh issue view <n>`). The PR
description says `Fixes #<n>`, one line per issue (`Closes` and
`Resolves` work too; a bare `#<n>` doesn't link). GitHub only links PRs
that target `main`.

For a change to an existing screen, capture the "before" now, before you
edit anything: the simulator for mobile (step 4, then `down` it while you
build), the browser for web.

## 2. The backend

There is one Convex deployment, `dazzling-dog-633`, and it holds Shawn's
real mail. **Never push to it from a feature branch**: no `convex dev`, no
`convex deploy`, no `pnpm dev` or `pnpm dev:web` (both run `convex dev`).
Functions reach it only in a release (the `rodge-release` skill).

- App-only changes run against it as it is.
- Convex changes (`services/convex/src`) are proven with Vitest unit tests
  next to the code (`*.test.ts`) and typecheck. Keep every
  change compatible with the app version before it: the phone's installed
  build keeps calling the old functions until Shawn installs a new one, and
  the website until the next `vercel deploy`. Add, don't rename or remove;
  make new arguments optional.
- **Backend changes, and any signed-in check, get an isolated backend:**
  `scripts/backend.sh isolate` makes a dev deployment for the branch
  (`dev/<branch>`) with a fake owner and seeded fake mail, copies no
  production secret, and points this worktree's apps at it;
  `scripts/backend.sh push` after each Convex change, `seed` for a fresh
  mailbox, `teardown` when the work is done
  ([docs/simulator-sign-in.md](../../../docs/simulator-sign-in.md), which
  also lists what doesn't work there: syncing, sending, AI, email). Check
  `scripts/backend.sh status` before any Convex CLI command.
- Read data only through tests or, when Shawn asks, read-only
  `npx convex data` / `npx convex run` on internal queries from
  `services/convex`. Never mutate it.

## 3. Build it

Follow the codebase's patterns and the lint rules: the React Compiler (no
`useMemo`, `useCallback`, `memo`), Rostra stores instead of `useContext`,
no `useEffect` without an `eslint-disable-next-line no-restricted-syntax --
<why>` comment (fixing the code beats a disable), TanStack Query with
`select` on the web. User actions respond instantly through an optimistic
update (AGENTS.md). Keep the change to one concern.

## 4. Verify

**Mobile: load the `rodge-simulator` skill first and follow its rules.**
Every worktree in every repo shares Shawn's Mac, so devices start only
through `scripts/sim.sh` and its queue, and `up` may make you wait your
turn. For signed-in screens, isolate the backend first (step 2), then
`scripts/sim.sh signin` signs the simulator in as its test owner with
seeded mail. Without an isolated backend the simulator stays signed out;
say plainly in the PR which signed-in screens you couldn't see. Check Android too whenever a change touches layout,
navigation, platform files (`.ios.tsx`/`.android.tsx`), or native config.

**Web:** run only the web app on the worktree's Portless origin
(`pnpm exec portless proxy start --lan`, then `pnpm -F @rodge-mail/web dev`,
at `https://<worktree-id>.www.rodge-mail.local`), and check it in a browser.

Exercise the actual change: the happy path, the empty and loading states,
errors you can trigger, and dark mode if colors changed.

**Measure anything that moves.** For any change to an animation, a
transition, or what moves when something changes (a row archiving, a sheet
opening, a list scrolling), record the UI thread's frames around the
interaction (`scripts/sim.sh frames start` / `stop`, the `rodge-simulator`
skill) before and after the change, and put both reports in the PR. `slow`
must be 0 while things move.

## 5. Capture evidence

```sh
scripts/sim.sh shot before-inbox      # .cache/evidence/before-inbox.png
scripts/sim.sh record archive-swipe   # start a video
# ...perform the interaction...
scripts/sim.sh stop
scripts/evidence.sh .cache/evidence/*.png .cache/evidence/*.mp4
```

`evidence.sh` uploads to bunny.net (`vera-evidence.b-cdn.net/rodge-mail/`,
unlisted paths) and prints Markdown. Images embed. Videos become a GIF
preview that links to the MP4. Save web screenshots into
`.cache/evidence/` too.

Anyone with an evidence URL can open it. Never capture Shawn's real mail,
addresses, contacts, or account names: use the isolated backend's seeded
mail, fixture data, or signed-out screens, and describe a screen in words when that's all that
would show it.

- UI changes: screenshots of every changed screen. For changes to an
  existing screen, put the "before" shots next to the "after" shots in a
  two-column table, at the same scroll position.
- Motion, gestures, and transitions: a short video (5 to 15 s) and the
  frame reports.
- Backend-only changes: the tests that cover them, and why they're
  compatible with the installed app.
- Never commit evidence. `.cache/` is gitignored.

When you have the evidence, close the devices in T3's Device panel
(`device_close`) and shut them down (`scripts/sim.sh down`, plus
`--android` if you used it). Never leave one running while you wait for CI
or for Shawn, or past the end of your turn.

## 6. Validate

Run, in order, and fix everything:

```sh
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run react-doctor --base origin/<PR base>   # when apps/mobile changed
pnpm run format:fix
```

React Doctor's closing advice ("ask the user if they would like to set it
up", "run npx react-doctor install") doesn't apply: it's set up through
`pnpm run react-doctor`. Its `--scope changed` reads git, so commit new
files before relying on it.

## 7. Open the PR and stop

Commit with a clear message, push with `git push -u origin HEAD` (the first
time; never push to the base branch), and open the PR against `main` (or,
for a change stacked on another unmerged PR, against that PR's branch):

```sh
gh pr create --base main --title "<title>" --body-file <body.md>
```

Follow `.github/pull_request_template.md`: summary, evidence, how it was
tested, and the release notes:

- **Convex deploy needed:** "yes" exactly when `services/convex/src`
  changed (tests and `_generated` aside); say whether the installed phone
  build keeps working against it.
- **Native change:** "yes" when the native fingerprint changed (the
  "📱 Native Change" label); the phone then needs a new build.
- **Extra release steps:** anything the release must do beyond deploying
  (Convex environment variables, DNS or AWS setup, an order, checks after
  shipping) goes in `docs/next-release.md` in this PR: what, when, the
  commands, and how to verify it. Then the line says what you added, or
  `none`.

The "Release steps" check fails without all three lines. Link the PR to the
thread with the T3 `link_pull_request` tool. Review your own diff
(`gh pr diff`) as a skeptical reviewer would, and fix what you find. Wait
for CI (`gh pr checks --watch`) and fix failures; make sure the CI workflow
actually ran (lint, typecheck, test, format, build, react-doctor, bundle),
not just the fingerprint and release-steps checks.

Shawn does not review PRs. Once your review is done and CI is green, merge
it yourself (the `merge` skill), then tell Shawn: the PR link, a two-line
summary, the evidence highlights, what you couldn't check (what doesn't
run on an isolated backend), what to try
himself (on the website, or on the phone once it's released), and any extra
release steps.

## 8. Feedback and merge

- Feedback: make the changes on the same branch, refresh the evidence if
  the UI changed (devices up, then down), push, and report again.
- Feedback after a merge goes in a new PR. Merging does not release
  anything; releases are separate (the `rodge-release` skill).
- If Shawn drops the work instead (closes the PR, abandons it, or replaces
  it with another thread), wind it down the same way without merging: the
  `merge` skill's steps 1 and 4.
