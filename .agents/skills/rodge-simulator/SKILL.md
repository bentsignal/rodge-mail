---
name: rodge-simulator
description: Required before you use an iOS simulator or Android emulator in this repo for any reason, such as verifying a change, taking screenshots or videos, measuring an animation, or reproducing a bug. Every worktree of every repo on Shawn's Mac shares one simulator queue, so devices start only through scripts/sim.sh. This skill has the rules that keep the Mac usable, the commands, and how to wait your turn.
---

# Simulators and emulators

Many worktrees, in Rodge, Vera, and SYNQ, run at once on Shawn's Mac.
`scripts/sim.sh up` waits in the simulator queue (`scripts/simq.ts`, a
verbatim copy of Vera's, so all three repos talk to one daemon), which runs
**up to three devices at once on the whole Mac**, iOS and Android alike: at
four the GPU runs out and every device lags. Booting a device pins every
core for half a minute or more, so boots and performance measurements
(`sim.sh frames start`) wait in the same line and never overlap. The queue
only works if every agent goes through it.

## Rules

1. **Only `scripts/sim.sh` starts, stops, or deletes a device.** Never boot
   or create one any other way: no `xcrun simctl boot` or `create`, no
   `npx expo run:ios` or `run:android`, no `expo start --ios`, no
   `pnpm ios`/`pnpm dev:ios`, no `emulator -avd`, no XcodeBuildMCP
   `boot_sim`, no Xcode or Android Studio runs. They skip the queue.
   `xcrun simctl` and `adb` on your own device for settings, such as
   `xcrun simctl ui <udid> appearance dark`, are fine.
2. **Never skip the queue.** Don't set `VERA_SIMQ=off`, don't stop or kill
   the daemon (`simq.ts stop`), and don't edit `~/.config/vera/simq.json`;
   that's Shawn's.
3. **Only touch your own worktree's device and Metro.** Never use, stop, or
   screenshot another worktree's simulator (`Rodge <other>`, `Vera ...`,
   `SYNQ ...`), even one that looks abandoned. The queue cleans those up.
4. **Wait your turn.** If `up` prints `simulator queue: position N of M`,
   it's waiting, and says why. If it exits with code 75 ("still queued"),
   run `up` again right away to keep your place; the place lapses after 5
   minutes. If your harness can run commands in the background and wake you
   when they finish, run `up` that way and do other work meanwhile.
   `frames start` waits the same way and exits 75 the same way.
5. **Hold a device only while you're using it.** Bring it up when you're
   ready to verify, and `down` as soon as you have your evidence, before you
   wait for CI or for Shawn. **Never end a turn with a device up.** A Stop
   hook (`.claude/hooks/devices-down.sh`) sends you back once if you try.
6. **Open each device in T3's Device panel at most once, and close it.**
   Every `device_open` starts a screen-mirroring loop in T3 that only
   `device_close` stops. Call `device_list` first: if your device is already
   open, reuse the agent-device flags you have. `device_close` it before
   `sim.sh down`, and never `device_open` another worktree's device or the
   shared `Vera template` simulator, which every repo's simulators are
   cloned from and which stays shut down.
7. **If the queue shut your device down**, your next `sim.sh` command says
   so. Run `up` again. The queue shuts down devices that haven't had a
   `sim.sh` command for 10 minutes when others are waiting, after 30
   minutes even if nobody is (any `sim.sh` command counts, `status`
   included), and right away if one stopped running without `sim.sh down`.

## Commands

```sh
scripts/sim.sh up             # wait for a slot, then dev client + this worktree's simulator + Metro
scripts/sim.sh open /compose  # go to any route: /thread/<id>, /(tabs)/(settings), ...
scripts/sim.sh relaunch       # restart the app, e.g. to drop the keyboard or reset state
scripts/sim.sh signin         # sign in as the isolated backend's test owner (scripts/backend.sh isolate first)
scripts/sim.sh reload         # reload the JavaScript
scripts/sim.sh shot <name>    # screenshot to .cache/evidence/<name>.png
scripts/sim.sh record <name>  # start a video; `scripts/sim.sh stop` ends it
scripts/sim.sh frames start   # record UI-thread frames; `frames stop` prints the report
scripts/sim.sh status         # this worktree's devices and Metro
scripts/sim.sh queue          # every device on the Mac, who is waiting, and why
scripts/sim.sh down           # delete the device; Metro stops with the last one
```

Every command takes `--android` first for this worktree's Android emulator
(`scripts/sim.sh --android up`). Both platforms share the worktree's Metro
and wait in the same queue. In T3 Code, `device_open` takes the emulator
serial `up` prints (`emulator-55xx`), with `platform: "android"`.

- The simulator is `Rodge <worktree>` (for example `Rodge t3-80b30f1b`).
  The app is a Debug dev client from a local EAS `development:client:sim`
  build, cached per native fingerprint in `~/Library/Caches/rodge-mail`
  and shared by every worktree. The first build of a fingerprint takes 10
  to 20 minutes and runs under the heavy-work lock all repos share
  (`scripts/bench/with-lock.sh`), before `up` joins the queue;
  `scripts/sim.sh build` does only that step. Re-run `up` after changing
  native code or `app.config.ts`. JavaScript edits hot-reload.
- Metro runs on a plain per-worktree port (`.cache/sim/metro`), not the
  Portless origin `pnpm dev` uses; the app is launched straight at
  `http://127.0.0.1:<port>`. Its log is `.cache/sim/metro.log`; check it for
  red boxes and warnings you introduced.
- `open`, `reload`, `signin`, and `frames` go through the dev-only
  `globalThis.rodgeDev` hook (`apps/mobile/src/features/dev/automation.ts`)
  over Metro's debugger connection, because iOS asks "Open in Rodge Mail?"
  before every `simctl openurl`.
- **Signing in needs an isolated backend.** The default backend is the
  production deployment with Shawn's real mail, so there the simulator
  stays signed out. `scripts/backend.sh isolate` gives the worktree its
  own dev deployment with a fake owner and seeded mail, and points Metro
  at it; then `scripts/sim.sh up` (or `relaunch`) and `scripts/sim.sh
signin` signs in as that owner, and evidence of it is safe to publish
  ([docs/simulator-sign-in.md](../../../docs/simulator-sign-in.md)).
  `signin` refuses without an isolated backend. Never sign in with Shawn's
  email or try to get a code sent to him.
- Let Shawn watch: call the T3 `device_open` tool with the simulator UDID
  that `up` prints, once (rule 6). It returns the exact `agent-device`
  command and flags; keep them for the rest of your session. Run
  `agent-device open com.bentsignal.rodgemail "${F[@]}"` once before other
  agent-device commands. Use agent-device for taps, typing, scrolling, and
  gestures (`snapshot -i`, `press @e3`, `fill`, `scroll`); take a fresh
  `snapshot -i` before each tap, since refs expire after every action. In
  zsh, put the flags in an array (`F=(--platform ios ...)`, then
  `"$F[@]"`).

## Measuring motion

```sh
scripts/sim.sh frames start
# ...do the interaction, a few times...
scripts/sim.sh frames stop   # {"frames":…,"hz":60,"slow":0,"dropped":0,"worst":[]}
```

`frames start` waits until no device on the Mac is booting, and no device
boots until your `frames stop`, so stop as soon as you have the
interaction. `frames stop` ends with a `mac:` line: if it says a device
booted during the recording, or the Mac was busy and the report shows slow
frames, measure again. `slow` must be 0 while things move. Measure before
and after your change and put both reports in the PR.

## Shutting down

When you have your evidence, and in any case before you end your turn:

1. `device_close` every device `device_list` shows open in this thread.
2. `scripts/sim.sh down`, and `scripts/sim.sh --android down` if you used
   Android. They delete the simulator or emulator, give the slot back to
   the queue, and stop Metro with the last device.

`up` brings one back in about a minute with the cached build.

## Troubleshooting

- **`up` keeps saying you're queued:** `scripts/sim.sh queue` shows why.
  That's working as intended; keep waiting, and do other work meanwhile.
  Tell Shawn if the line hasn't moved in half an hour.
- **`up` says Metro didn't start:** read `.cache/sim/metro.log`. Kill only
  the PID in `.cache/sim/metro`, never by pattern (other worktrees run
  Metro too).
- **The app shows the dev launcher instead of Rodge Mail:**
  `scripts/sim.sh relaunch`.
- **The dev client build fails:** it's a local EAS build; the log is in
  the `up` output. See the `rodge-expo-build` skill. A missing fastlane or
  CocoaPods is usually `PATH` (Homebrew's fastlane first, then rbenv's
  shims, which `sim.sh` sets).
- **The Mac is slow or a simulator is stuck "Shutting Down":** check for
  T3's device preview running away
  (`ps -Ao pid,%cpu,rss,command | grep -i device-preview`). Don't kill it
  yourself; tell Shawn.
