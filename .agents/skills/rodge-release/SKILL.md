---
name: rodge-release
description: Run a Rodge Mail release end to end, covering what changed since the last release, what to test where those changes meet, Convex functions to the one deployment, the website to mail.rodgers.dev, and a new local EAS build on Shawn's iPhone. Use when Shawn asks to release, ship, deploy, push the backend or website, or put a new build on his phone, or asks what changed since the last release.
---

# Releasing Rodge Mail

Read [docs/releasing.md](../../../docs/releasing.md) first, then
[docs/next-release.md](../../../docs/next-release.md): it lists one-off
steps this release needs beyond this skill. Do every step it lists, at the
point it says, and verify each one. A step you can't do blocks the release:
tell Shawn. After shipping, open a PR that removes the finished ones.

Releases always come from `origin/main`, never from a feature branch.
Step 3 decides when to ship; ask Shawn only for what needs him.

## 0. Get onto main

Work in a clean checkout at `origin/main`. In a T3 worktree:

```sh
git fetch origin --tags && git checkout --detach origin/main && pnpm install --frozen-lockfile
```

## 1. Plan

```sh
last="$(git tag --list 'release/*' --sort=-creatordate | head -1)"
git log --oneline "$last"..origin/main
gh pr view <n> --json title,body   # for each merged PR it lists
```

No `release/*` tag yet: ask Shawn which commit was last released. Each
merged PR's description ends with release notes; start from those and
`docs/next-release.md`. Write up for Shawn:

- **Parts:** Convex (any "Convex deploy needed: yes"), website (any change
  under `apps/web`, `shared/`, or `services/convex` that the web uses), phone
  (any change under `apps/mobile` or `shared/`; a "Native change: yes" means
  the build needs the native acceptance checks too).
- **What's new:** a short list in his words, not PR titles.
- **What to test:** only what merging could have broken: files, components,
  or Convex functions more than one PR touched
  (`git log --format='%h %s' --name-only "$last"..origin/main`), changes
  to the same flow from different ends, and backend changes paired with app
  changes that didn't test against each other. If nothing overlaps, say so.
- **Compatibility:** for each Convex change, whether the website and the
  phone's installed build keep working between the Convex deploy and their
  own updates.

## 2. Check it yourself first

Run what you can of the test list before sending it: the website against
the worktree's Portless origin (`pnpm exec portless proxy start --lan`,
then `pnpm -F @rodge-mail/web dev`; never `pnpm dev`, which runs
`convex dev`), and the mobile app in the simulator (the `rodge-simulator`
skill; it's signed out, so only what's reachable there). Fix what fails
the usual way (a PR, the `rodge-feature` skill) before Shawn sees it.
Then send him the write-up, split into what you checked (with evidence)
and what's for him.

## 3. Decide

Shawn delegates releases. When your own checks pass and nothing in the
plan needs him (a phone install, an account login, a decision only he can
make), ship. Tell him what shipped, and ask only for what needs him.

## 4. Ship

In this order, skipping parts the plan doesn't need, doing each
`docs/next-release.md` step where it says:

**Convex** (from `services/convex`, whose `.env.local` points at
`dazzling-dog-633`):

```sh
cd services/convex
pnpm exec convex dev --once --tail-logs disable
```

Then call what changed (`npx convex run` on an internal query, or `curl` an
HTTP route) to check it's live, and `npx convex logs` for errors.

**Website** (from the repository root):

```sh
vercel deploy --prod
```

Open `https://mail.rodgers.dev` and check it loads and is signed in
(Shawn's session) or shows sign-in.

**Phone:** follow the `rodge-expo-build` skill's physical iPhone workflow:
the `development` profile IPA, its entitlement checks, install with
`xcrun devicectl`, and the notification acceptance gate. The phone has to
be connected (USB or the same network). If it isn't reachable, ship the
other parts and tell Shawn the build is ready to install.

Then tag what shipped and push the tag:

```sh
tag="release/$(date +%Y%m%d-%H%M)"
git tag -a "$tag" -m "<parts shipped; release notes>" && git push origin "$tag"
```

Report what shipped, the tag, and anything that didn't work.

## Rolling back

- Convex: check out the last release tag (`git checkout --detach <tag>`),
  `pnpm install --frozen-lockfile`, and push it the same way. Schema changes
  that deleted data can't be undone this way; tell Shawn.
- Website: `vercel rollback` to the previous production deployment
  (`vercel ls` lists them).
- Phone: install the previous IPA if it's still in `apps/mobile/build/`, or
  build one from the last tag.
