# AGENTS.md

## Repository summary

Rodge Mail is a focused, AI-native email client for one owner, Shawn. It
has a TanStack Start web app (`apps/web`, hosted on Vercel at
`https://mail.rodgers.dev`), an Expo React Native app (`apps/mobile`,
`com.bentsignal.rodgemail`), and a terminal client (`apps/cli`). Everything
runs on Convex (`services/convex`): mail storage, Gmail, Microsoft 365, and
iCloud sync, mailboxes hosted on custom domains through Amazon SES, search,
and classification. Read [README.md](README.md),
[docs/development.md](docs/development.md),
[docs/architecture.md](docs/architecture.md), and the Markdown in
`services/convex` (`AUTH.md`, `PROVIDERS.md`, `AI.md`, ...) before asking
design or infrastructure questions.

There is **one Convex deployment, `dazzling-dog-633`**. It is called a dev
deployment, but it serves production: the website and Shawn's phone both
use it, and it holds his real mail. Never push functions to it
(`convex dev`, `convex deploy`) outside a release Shawn asked for, and never
write to its data except through the app as he would.

Auth is owner-only (Better Auth, email codes and passkeys,
`AUTH_ALLOWED_USER_ID`). Registration is closed.

Backend changes and signed-in checks get an **isolated backend**:
`scripts/backend.sh isolate` creates a dev deployment for the branch with
a fake owner and seeded fake mail (no production secrets), points this
worktree's apps at it, and `scripts/sim.sh signin` signs the simulator in.
`push` after Convex changes, `teardown` when done
([docs/simulator-sign-in.md](docs/simulator-sign-in.md)).

## Project knowledge

Record decisions, plans, and durable context as Markdown in this repository
(`docs/`, package READMEs, or `.notes/`). Do not use external memory or task
CLIs (such as UAV) or Claude Code auto memory for this project.

## Computer use

For anything that needs a browser, dashboard, or GUI (the Convex, Vercel,
AWS, or bunny.net dashboards), prefer the service's CLI or API first. If
only a GUI will do, use the Codex CLI with the GPT 6.1 Sol model, headless
where possible, instead of driving the screen yourself:
`codex exec -m gpt-6.1-sol -s danger-full-access "<task>" < /dev/null`
(run it from the repo, since Codex refuses untrusted directories, and close
stdin or it waits for input). Never open repeated browser tabs or login
pages in the background; tell Shawn before anything opens on his machine.

## Feature workflow

Shawn starts each feature or fix in its own T3 Code worktree and thread
(`t3.json` runs `scripts/worktree-setup.sh` on creation). Follow the
`rodge-feature` skill. In short:

- Work only in the worktree and branch you were given. T3 names the branch;
  do not rename it. Never commit directly to `main`.
- Own the Git workflow: commit and push completed, validated work on the
  branch regularly without waiting to be asked. Do not leave work
  uncommitted between sessions; push it and note its state in the PR.
- Verify in this worktree's own simulator (`scripts/sim.sh`), never another
  worktree's or a shared one. Load the `rodge-simulator` skill before any
  simulator or emulator use: devices start only through `scripts/sim.sh`,
  which queues them with every other repo on the Mac (Vera, SYNQ): up to
  three run at once, and a boot never overlaps a performance measurement.
  Wait on `up` with foreground calls at the longest timeout, run it again
  right away when it exits 75 (still queued) or times out, and never end
  your turn while it's queued. Open a
  device in T3's Device panel (`device_open`) at most once, and close it
  (`device_close`) before `scripts/sim.sh down`. Shut the device
  down as soon as you have your evidence, and always before you end your
  turn. A Stop hook sends you back if one is still up, and the queue
  deletes devices left idle for 30 minutes.
- Web changes are checked in the browser against the worktree's Portless
  origin (`https://<worktree>.www.rodge-mail.local`): start the proxy
  (`pnpm exec portless proxy start --lan`) and only the web app
  (`pnpm -F @rodge-mail/web dev`). Never `pnpm dev` or `pnpm dev:web`: both
  also run `convex dev`, which pushes this worktree's functions to the
  production deployment.
- UI changes need screenshots (before and after where something changed);
  motion and gestures need a video. Upload with `scripts/evidence.sh` and put
  them in the PR description. Never commit PR assets. Evidence URLs are
  public (unlisted, not private), so evidence never shows Shawn's real mail,
  addresses, or contacts: capture demo or fixture data, or describe the
  screen in words instead.
- Keep each pull request to one coherent change, with a description covering
  the summary, the evidence, and the validation that was run
  (`.github/pull_request_template.md`).
- Open the PR, review your own diff as a skeptical reviewer, and wait for
  CI to pass.
- **Shawn does not review PRs.** The agent running the work owns review,
  merging, and releases. Once your self-review is done, CI is green, and
  the change is verified, merge it yourself with the `merge` skill: squash
  and merge, delete the branch, devices down, and the thread settled. Then
  tell Shawn what merged and anything he should try himself.

## Releases

Merging does not release anything. When Shawn asks for a release, follow
the `rodge-release` skill ([docs/releasing.md](docs/releasing.md)): Convex
functions to `dazzling-dog-633`, the website with `vercel deploy --prod`,
and a new local EAS build for his phone when the mobile app changed. The
phone runs a standalone build with its JavaScript embedded and no
over-the-air updates, so a mobile change reaches it only in a new build.

**Extra release steps go in [docs/next-release.md](docs/next-release.md),
in the PR that needs them.** Convex environment variables, DNS or AWS
setup, an order to deploy in, or a check after shipping: list each one
there (what, when, the commands, and how to verify it) in that same PR, and
say so on the PR's "Extra release steps" line. CI fails a PR without the
line.

## Required validation after changes

At the end of every run, run these in order:

1. `pnpm run lint`
2. `pnpm run typecheck`
3. `pnpm run test`
4. `pnpm run react-doctor --base origin/main` when the mobile app changed
   (use the PR's base branch if it isn't `main`)

If all succeed, run `pnpm run format:fix`, then summarize the changes.

Lint enforces the React rules: the React Compiler handles memoization (no
`useMemo`, `useCallback`, or `memo`), `useEffect` is banned except with an
`eslint-disable-next-line no-restricted-syntax -- <why>` comment saying why
nothing else works, Rostra stores instead of `useContext`, and uncontrolled
`TextInput`s. CI also exports the iOS bundle and labels PRs that change
native code ("📱 Native Change"). Every PR's release notes say "Convex
deploy needed", "Native change", and "Extra release steps", and CI checks
all three.

UI and performance rules:

- **User actions respond instantly.** A tap or click shows its result right
  away, never after a server round trip. Give the Convex mutation an
  optimistic update (`useMutation(...).withOptimisticUpdate(...)`, as in
  `use-archive-actions.ts` and `use-thread-actions.ts`) that changes the
  queries it affects, then close the sheet or navigate immediately. Don't
  `await` the mutation before responding or disable a control while it's
  pending. Report a failure afterwards; the optimistic update rolls back on
  its own. The only exception is a result only the server can produce; say
  so in a comment.
- **Measure anything that moves.** For any change to an animation, a
  transition, or a list's motion, record the UI thread's frames before and
  after (`scripts/sim.sh frames start` / `stop`) and put both reports in the
  PR. `slow` must be 0 while things move. Move things with `transform` and
  `opacity`, not layout.
- **No explanation text under self-explanatory UI.** Don't add footers,
  captions, or hint text that explain an option, button, or field whose
  label already says what it does. Add one only when Shawn asks for it.

## Preferences

- Do **_NOT_** leave excessive comments when writing code. Only leave
  comments when the code itself does not clearly explain what it does.
