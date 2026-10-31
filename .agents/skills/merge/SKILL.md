---
name: merge
description: Use to merge a pull request once its self-review is done, CI is green, and the change is verified. Shawn does not review PRs; the agent running the work merges them. Also use when Shawn says "merge it", "ship it", or "approved".
---

# Merge

Shawn delegates merging: merge the PRs linked to this thread once each is
reviewed, green, and verified, and do everything that follows a merge:
devices come down and the thread is settled. Merging releases nothing (the `rodge-release` skill
does that). Do each step that applies, in order, without asking.

## 1. Stop what's running

Call `device_list` and `device_close` every device it shows open in this
thread's Device panel. Then:

```sh
scripts/sim.sh down; scripts/sim.sh --android down
scripts/sim.sh status        # ios: none, android: none, metro: stopped
xcrun simctl list devices | grep "Rodge $(basename "$PWD")" || echo gone
```

Stop a web dev server you started in this worktree (only its own process).
If a simulator won't shut down (stuck "Shutting Down"), the Mac's simulator
service is jammed: tell Shawn in your report, and don't settle the thread
as if everything is stopped.

## 2. Check the PR is ready

- Nothing uncommitted or unpushed in the worktree (`git status`, then
  `git push`).
- CI passed on the PR's latest commit (`gh pr checks <number> --watch`).
  Fix failures before merging.
- If the PR's description no longer matches the change (later feedback
  rounds), update it, release notes included.

## 3. Merge

Squash and merge, with the PR's title as the subject:

```sh
gh pr merge <number> --squash --subject "<PR title> (#<number>)" --delete-branch
gh pr view <number> --json state     # MERGED
```

Use `--merge` instead only when there's a reason to keep the branch's
commits as they are, and say why in your report. A stack is one: merge it
with `--merge` from the bottom up, retargeting each layer to `main` as the
one below it merges.

`gh pr merge` may say it can't switch to `main` because another checkout has
it. The merge still happened. Delete the remote branch with
`git push origin --delete <branch>` if it's still there.

Don't deploy anything here, even when the PR says "Convex deploy needed:
yes". That happens in the next release.

## 4. Settle the T3 thread

- `list_thread_pull_requests`: every PR from this work is linked and
  merged. Link any that's missing.
- `unwatch_pull_request` for each PR being watched.
- `t3_thread_organize` with `action: "settle"`. It takes effect when your
  turn ends.

## 5. Report

Say what was merged (PR link), that it isn't released yet (whether it needs
a Convex deploy, a web deploy, or a phone build when it is), and any extra
release steps it added to `docs/next-release.md`. Keep it short.
