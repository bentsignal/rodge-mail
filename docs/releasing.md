# Releasing

Merging to `main` ships nothing. Shawn decides when to release, and an
agent runs it with the `rodge-release` skill. A release has up to three
parts, always from `origin/main`, in this order:

| Part          | What it updates                                 | Command                                                     | Needed when                                 |
| ------------- | ----------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| Convex        | functions and schema on `dazzling-dog-633`      | `pnpm exec convex dev --once` from `services/convex`        | a merged PR said "Convex deploy needed: yes" |
| Website       | `https://mail.rodgers.dev` (Vercel `bsx-sh/rodge-mail`) | `vercel deploy --prod` from the repository root       | `apps/web` or a package it uses changed     |
| Shawn's phone | the standalone Rodge Mail build on his iPhone   | local EAS `development` IPA (the `rodge-expo-build` skill)  | `apps/mobile` or a package it uses changed  |

Convex goes first so the website and phone never call functions that
don't exist yet. That only works if every Convex change stays compatible
with the clients before it (the `rodge-feature` skill, step 2): the
website keeps its old bundle until its deploy, and the phone keeps its
embedded JavaScript until Shawn installs a new build.

## One deployment

`dazzling-dog-633` is the only Convex deployment. It is named a dev
deployment, but the website and the phone use it and it holds Shawn's real
mail, so a Convex push is a production deploy. `convex dev --once` pushes
once and exits; never leave `convex dev` running against it.

## The phone

The phone runs a standalone EAS `development` build (internal
distribution, its JavaScript embedded, no expo-updates and no update
channel), so JavaScript and native changes alike reach it only in a new
build. `app.config.ts` only allows `development*` EAS profiles. Building and
installing it, and the notification checks every build must pass, are in
the `rodge-expo-build` skill.

The simulators use a different binary: a `development:client:sim` dev
client cached per native fingerprint (`scripts/sim.sh`). See
[phone-testing.md](phone-testing.md) for the planned Rodge Dev app that
would let the phone load a worktree's JavaScript without a release.

## Release notes and extra steps

Every PR's description ends with release notes ("Convex deploy needed",
"Native change", "Extra release steps"), checked by CI
(`scripts/check-release-steps.ts`, `.github/workflows/mobile-fingerprint.yml`).
The release starts from those. Anything else a release has to do (Convex
environment variables, DNS or AWS setup, an order, checks after shipping)
is in [next-release.md](next-release.md), added by the PR that needs it.

## Tags

Each release tags the commit it shipped, `release/<YYYYMMDD-HHMM>`, and
pushes the tag. The next release lists what changed since the newest
`release/*` tag (`git log --oneline <tag>..origin/main`). Until the first
tag exists, ask Shawn which commit was last released.
