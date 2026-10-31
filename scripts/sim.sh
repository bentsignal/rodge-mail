#!/usr/bin/env bash
# This worktree's own iOS simulator and Android emulator, for verifying
# changes and capturing PR evidence. One device per platform and one Metro
# port per worktree, so agents in different worktrees never share a screen.
#
#   scripts/sim.sh [--android] <command>     (iOS without --android)
#
#   up               build or reuse the dev client, boot, start Metro, open the app
#   build            cache the dev client without entering the device queue
#   open <path>      go to a route, such as `/compose` or `/thread/<id>`
#   shot <name>      screenshot to .cache/evidence/<name>.png
#   record <name>    start a video to .cache/evidence/<name>.mp4
#   stop             stop the video
#   reload           reload the JavaScript
#   relaunch         restart the app (clears in-memory state)
#   eval "<js>"      evaluate JavaScript in the running app
#   frames start     record the UI thread's frames (to measure an animation);
#                    waits until no device on the Mac is booting
#   frames stop      stop, and report the frames that drew slowly and how
#                    busy the Mac was
#   signin           sign in as the isolated backend's test owner
#                    (scripts/backend.sh isolate first; docs/simulator-sign-in.md)
#   status           devices, port, and Metro
#   queue            the simulator queue: devices up on this Mac, who is waiting, and why
#   down             delete this platform's device; stops Metro when no device is left
#
# `up` and `frames start` wait their turn in the simulator queue
# (scripts/simq.ts): up to three devices at once on the whole Mac, Rodge's,
# Vera's, and SYNQ's together, and a boot never overlaps a performance
# measurement. Exit code 75 means still queued: run the same command again
# to keep your place. VERA_SIMQ=off skips the queue (the daemon sets it when
# it calls `down`; agents never do).
#
# scripts/simq.ts is a verbatim copy of Vera's, so every repo talks to one
# daemon (~/Library/Caches/vera/simq). The daemon reclaims a device by
# running its worktree's `scripts/sim.sh [--android] down`, which reads the
# state in .cache/sim/<ios|android> (DEVICE=, SERIAL=, ...). Keep that
# layout and `down` when changing this file.
#
# iOS simulators are clones of a template that has already booted once, so
# they skip iOS's first-boot setup. The template is Vera's
# (~/Library/Caches/vera/ios-template-<runtime>), shared rather than made
# again.
#
# Each dev client is a local EAS `development:client:sim` build (Debug,
# expo-dev-client), built once per native fingerprint and cached in
# ~/Library/Caches/rodge-mail, so worktrees only rebuild when native code
# changed. The build runs under the heavy-work lock every repo shares
# (scripts/bench/with-lock.sh). JavaScript comes from this worktree's Metro
# (scripts/lib/metro.sh), which both platforms share.
set -euo pipefail

PLATFORM=ios
if [ "${1:-}" = "--android" ]; then
  PLATFORM=android
  shift
fi

ROOT="$(git rev-parse --show-toplevel)"
MOBILE="$ROOT/apps/mobile"
STATE_DIR="$ROOT/.cache/sim"
EVIDENCE="$ROOT/.cache/evidence"
CACHE="$HOME/Library/Caches/rodge-mail"
# Vera's cache, for the simulator template every repo clones from.
VERA_CACHE="$HOME/Library/Caches/vera"
BUNDLE_ID="com.bentsignal.rodgemail"
SCHEME="rodge-mail"
IOS_DEVICE_TYPE="com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro"
ANDROID_BASE_AVD="Pixel_9"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$ANDROID_HOME/platform-tools/adb"
mkdir -p "$STATE_DIR" "$EVIDENCE" "$CACHE" "$VERA_CACHE"
# shellcheck source=lib/metro.sh
. "$ROOT/scripts/lib/metro.sh"

slug() {
  basename "$ROOT" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

flag() { [ "$PLATFORM" = android ] && echo " --android" || true; }

# State: Metro is shared; each platform keeps its own device.
load() {
  DEVICE="" SERIAL="" EMULATOR_PID="" RECORD_PID=""
  load_metro
  # shellcheck disable=SC1090
  [ -f "$STATE_DIR/$PLATFORM" ] && . "$STATE_DIR/$PLATFORM"
  return 0
}
save() {
  save_metro
  printf 'DEVICE=%s\nSERIAL=%s\nEMULATOR_PID=%s\nRECORD_PID=%s\n' \
    "$DEVICE" "$SERIAL" "$EMULATOR_PID" "$RECORD_PID" >"$STATE_DIR/$PLATFORM"
}

# The simulator queue, which needs nothing installed; see scripts/simq.ts.
queue() {
  [ "${VERA_SIMQ:-on}" = off ] && return 0
  node --experimental-strip-types --no-warnings "$ROOT/scripts/simq.ts" "$@" --worktree "$ROOT"
}

require_up() {
  load
  if [ -z "$DEVICE" ]; then
    cat "$STATE_DIR/$PLATFORM.reclaimed" >&2 2>/dev/null || true
    echo "no $PLATFORM device yet; run scripts/sim.sh$(flag) up" >&2
    exit 1
  fi
}

adb_device() { "$ADB" -s "$SERIAL" "$@"; }

# Expo's own fingerprint CLI (expo/bin/fingerprint): Rodge has no
# expo-updates.
fingerprint() {
  (cd "$MOBILE" && pnpm exec fingerprint fingerprint:generate --platform "$PLATFORM" </dev/null 2>/dev/null) |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).hash))'
}

# fastlane from Homebrew must come before rbenv's shim; CocoaPods comes
# from rbenv, which only login shells set up.
eas_build() {
  PATH="/opt/homebrew/bin:$HOME/.rbenv/shims:$PATH" eas build --local --non-interactive \
    --profile development:client:sim "$@" </dev/null
}

build_ios_client() {
  local work app
  work="$(mktemp -d)"
  # shellcheck disable=SC2064 # the path now: work is local
  trap "rm -rf '$work'" RETURN
  eas_build --platform ios --output "$work/client.tar.gz"
  tar -xzf "$work/client.tar.gz" -C "$work"
  app="$(find "$work" -maxdepth 3 -name '*.app' -type d | head -1)"
  [ -n "$app" ] || {
    echo "the EAS build has no .app" >&2
    return 1
  }
  cp -R "$app" "$1"
}

build_android_client() {
  JAVA_HOME="$(/usr/libexec/java_home -v 17)" eas_build --platform android --output "$1"
}

# Builds the dev client for this fingerprint unless a worktree already did.
ensure_client() {
  local hash dir lock artifact
  hash="$(fingerprint)"
  [ -n "$hash" ] || {
    echo "couldn't compute the native fingerprint; is pnpm install done?" >&2
    exit 1
  }
  dir="$CACHE/dev-client-$PLATFORM/$hash"
  artifact="$dir/$([ "$PLATFORM" = ios ] && echo RodgeMail.app || echo rodge-mail.apk)"
  CLIENT="$artifact"
  [ -e "$artifact" ] && return
  mkdir -p "$(dirname "$dir")"
  lock="$dir.lock"
  until mkdir "$lock" 2>/dev/null; do
    echo "another worktree is building this dev client; waiting"
    sleep 15
    [ -e "$artifact" ] && return
  done
  # shellcheck disable=SC2064 # the path now: lock is local
  trap "rmdir '$lock' 2>/dev/null || true" EXIT
  echo "building the $PLATFORM dev client for fingerprint $hash (native code changed or first run; 10 to 20 minutes)"
  rm -rf "$dir.partial"
  mkdir -p "$dir.partial"
  local platform_flag=()
  [ "$PLATFORM" = android ] && platform_flag=(--android)
  (cd "$MOBILE" && "$ROOT/scripts/bench/with-lock.sh" "$ROOT/scripts/sim.sh" ${platform_flag[@]+"${platform_flag[@]}"} build-client "$dir.partial/$(basename "$artifact")")
  mv "$dir.partial" "$dir"
  rmdir "$lock"
  trap - EXIT
}

latest_ios_runtime() {
  xcrun simctl list runtimes -j | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      const ios=JSON.parse(s).runtimes.filter(r=>r.platform==="iOS"&&r.isAvailable);
      console.log(ios.at(-1).identifier);
    })'
}

# The Mac's CPU, busy percent of all cores over two seconds.
cpu_busy() {
  top -l 2 -s 2 -n 0 | awk '/CPU usage/ { for (i = 1; i <= NF; i++) if ($i == "idle") idle = $(i - 1) } END { sub("%", "", idle); printf "%d\n", 100 - idle }'
}

# The simulator every repo's worktrees clone from: booted once until iOS's
# first-boot work is done, then shut down for good. One per runtime,
# recorded and locked in Vera's cache exactly as Vera's sim.sh does, so
# whichever repo needs it first makes it, inside that `up`'s queue slot; a
# new runtime (an Xcode update) replaces it.
ios_template() {
  local runtime record udid lock name calm=0 started old
  runtime="$(latest_ios_runtime)"
  record="$VERA_CACHE/ios-template-$runtime"
  udid="$(cat "$record" 2>/dev/null || true)"
  if [ -n "$udid" ] && xcrun simctl list devices -j | grep -q "\"$udid\""; then
    echo "$udid"
    return
  fi
  lock="$VERA_CACHE/ios-template.lock"
  until mkdir "$lock" 2>/dev/null; do
    echo "another worktree is preparing the simulator template; waiting" >&2
    sleep 10
  done
  # shellcheck disable=SC2064 # the path now: lock is local
  trap "rmdir '$lock' 2>/dev/null || true" EXIT
  udid="$(cat "$record" 2>/dev/null || true)"
  if [ -z "$udid" ] || ! xcrun simctl list devices -j | grep -q "\"$udid\""; then
    # Vera's name, since it's Vera's template too (every repo's skills say
    # never to open the "Vera template" simulator).
    name="Vera template ${runtime##*.}"
    echo "preparing the simulator template for ${runtime##*.} (once per iOS version, about 3 minutes)" >&2
    udid="$(xcrun simctl create "$name" "$IOS_DEVICE_TYPE" "$runtime")"
    xcrun simctl bootstatus "$udid" -b >/dev/null
    # First-boot setup has finished when the CPU stays calm.
    started=$SECONDS
    sleep 60
    while [ $((SECONDS - started)) -lt 300 ] && [ "$calm" -lt 3 ]; do
      if [ "$(cpu_busy)" -lt 40 ]; then calm=$((calm + 1)); else calm=0; fi
      sleep 5
    done
    xcrun simctl shutdown "$udid"
    echo "$udid" >"$record"
    # Templates for older runtimes.
    for old in "$VERA_CACHE"/ios-template-*; do
      [ "$old" = "$record" ] && continue
      xcrun simctl delete "$(cat "$old")" 2>/dev/null || true
      rm -f "$old"
    done
  fi
  rmdir "$lock"
  trap - EXIT
  echo "$udid"
}

ensure_ios_device() {
  if [ -z "$DEVICE" ] || ! xcrun simctl list devices -j | grep -q "\"$DEVICE\""; then
    DEVICE="$(xcrun simctl clone "$(ios_template)" "Rodge $(slug)")"
    echo "created simulator Rodge $(slug) ($DEVICE)"
  fi
  # Saved before booting, so the queue can reclaim it if `up` fails.
  save
  xcrun simctl bootstatus "$DEVICE" -b >/dev/null
}

# A throwaway AVD per worktree, cloned from the base Pixel AVD's system image
# and hardware profile. `down` deletes it.
ensure_android_device() {
  local avd_home="$HOME/.android/avd" base_ini name
  name="Rodge_$(slug | tr '-' '_')"
  DEVICE="$name"
  if [ ! -d "$avd_home/$name.avd" ]; then
    base_ini="$avd_home/$ANDROID_BASE_AVD.avd/config.ini"
    local image device
    image="$(grep '^image.sysdir.1' "$base_ini" | cut -d= -f2 | tr -d ' ' | sed 's#/$##' | tr '/' ';')"
    device="$(grep '^hw.device.name' "$base_ini" | cut -d= -f2 | tr -d ' ')"
    echo no | "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" -s create avd \
      -n "$name" -k "$image" -d "$device" >/dev/null
    echo "created emulator $name"
  fi
  if [ -n "$SERIAL" ] && adb_device get-state >/dev/null 2>&1; then
    return
  fi
  # adb auto-discovers only the standard console ports. Outside this range
  # a server reconnect can lose a live emulator, which the queue reclaims.
  local console start=$(($(hash_of "$ROOT") % 13)) available=0
  for offset in $(seq 0 12); do
    console=$((5560 + 2 * ((start + offset) % 13)))
    if ! lsof -nP -iTCP:"$console" -sTCP:LISTEN >/dev/null 2>&1 &&
      ! "$ADB" devices | grep -q "emulator-$console"; then
      available=1
      break
    fi
  done
  if [ "$available" != 1 ]; then
    echo "no standard Android emulator console port is free" >&2
    exit 1
  fi
  SERIAL="emulator-$console"
  # A separate session survives the launching tool's process-group cleanup.
  EMULATOR_PID="$(node - "$ANDROID_HOME/emulator/emulator" "$name" "$console" "$STATE_DIR/emulator.log" <<'JS'
const { spawn } = require("node:child_process");
const { openSync, closeSync } = require("node:fs");
const [emulator, name, port, log] = process.argv.slice(2);
const output = openSync(log, "w");
const child = spawn(emulator, ["-avd", name, "-port", port, "-no-window", "-no-snapshot", "-no-boot-anim", "-no-audio"], {
  detached: true,
  stdio: ["ignore", output, output],
});
child.unref();
closeSync(output);
console.log(child.pid);
JS
)"
  save
  "$ADB" -s "$SERIAL" wait-for-device
  until [ "$(adb_device shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do
    sleep 2
  done
}

install_client() {
  if [ "$PLATFORM" = ios ]; then
    xcrun simctl install "$DEVICE" "$CLIENT"
    # No dev menu tour or floating tools button in screenshots; the dev
    # menu still opens with Cmd-Ctrl-Z or a shake.
    xcrun simctl spawn "$DEVICE" defaults write "$BUNDLE_ID" EXDevMenuIsOnboardingFinished -bool YES
    xcrun simctl spawn "$DEVICE" defaults write "$BUNDLE_ID" EXDevMenuShowFloatingActionButton -bool NO
    xcrun simctl spawn "$DEVICE" defaults write "$BUNDLE_ID" EXDevMenuShowsAtLaunch -bool NO
  else
    adb_device install -r -g "$CLIENT" >/dev/null
    adb_device shell run-as "$BUNDLE_ID" sh -c "'mkdir -p shared_prefs && printf \"%s\" \"<?xml version=\\\"1.0\\\" encoding=\\\"utf-8\\\" standalone=\\\"yes\\\" ?><map><boolean name=\\\"isOnboardingFinished\\\" value=\\\"true\\\" /><boolean name=\\\"showFab\\\" value=\\\"false\\\" /><boolean name=\\\"showsAtLaunch\\\" value=\\\"false\\\" /></map>\" > shared_prefs/expo.modules.devmenu.sharedpreferences.xml'"
  fi
}

# Metro's debugger targets are named after the device (the simulator's name
# on iOS, the model on Android). Each worktree has its own Metro, so this
# only has to tell the two platforms apart.
target_name() {
  if [ "$PLATFORM" = ios ]; then
    echo "Rodge $(slug)"
  else
    adb_device shell getprop ro.product.model | tr -d '\r'
  fi
}

app_eval() {
  RODGE_DEVICE="$(target_name)" node "$ROOT/scripts/sim-eval.mjs" "$PORT" "$1"
}

# Brings the running app to the front without restarting it. On a fresh
# simulator, SpringBoard can come up over the app after it launches.
front() {
  if [ "$PLATFORM" = ios ]; then
    xcrun simctl launch "$DEVICE" "$BUNDLE_ID" >/dev/null
  else
    adb_device shell am start -n "$BUNDLE_ID/.MainActivity" >/dev/null 2>&1 || true
  fi
}

# Moves the app to a route through the dev-only `rodgeDev` hook over Metro's
# debugger connection. Deep links would work too, but iOS asks "Open in
# Rodge Mail?" before every `simctl openurl`, which scripts cannot answer.
open_path() {
  local path="/${1#/}"
  front
  app_eval "globalThis.rodgeDev.open($(node -p 'JSON.stringify(process.argv[1])' "$path"))" >/dev/null
  echo "opened $path"
}

launch() {
  if [ "$PLATFORM" = ios ]; then
    xcrun simctl terminate "$DEVICE" "$BUNDLE_ID" 2>/dev/null || true
    xcrun simctl launch "$DEVICE" "$BUNDLE_ID" --initialUrl "http://127.0.0.1:$PORT" >/dev/null
  else
    adb_device reverse "tcp:$PORT" "tcp:$PORT" >/dev/null
    adb_device shell am force-stop "$BUNDLE_ID"
    # The emulator's host alias survives adb transport reconnects, unlike
    # reverse forwarding.
    adb_device shell am start -a android.intent.action.VIEW \
      -d "$SCHEME://expo-development-client/?url=$(node -p "encodeURIComponent('http://10.0.2.2:$PORT')")" \
      "$BUNDLE_ID" >/dev/null
  fi
  for _ in $(seq 1 180); do
    if app_eval "typeof globalThis.rodgeDev" 2>/dev/null | grep -q object; then
      front
      return
    fi
    sleep 1
  done
  echo "the app did not finish loading; see $STATE_DIR/metro.log" >&2
  exit 1
}

up() {
  load
  ensure_client
  rm -f "$STATE_DIR/$PLATFORM.reclaimed"
  queue acquire "$PLATFORM"
  "ensure_${PLATFORM}_device"
  install_client
  ensure_metro
  save
  launch
  queue ready "$PLATFORM" --device "$DEVICE" --serial "$SERIAL" --metro-pid "$METRO_PID"
  status
  echo "watch it in T3 Code: device_open with deviceId $([ "$PLATFORM" = ios ] && echo "$DEVICE" || echo "$SERIAL"), once (device_list shows what's open)"
  echo "when done: device_close, then scripts/sim.sh$(flag) down, before you end your turn"
}

status() {
  local saved="$PLATFORM"
  for PLATFORM in ios android; do
    load
    echo "$PLATFORM: ${DEVICE:-none}"
  done
  PLATFORM="$saved"
  load
  echo "metro: ${PORT:-none} ($(metro_running && echo running || echo stopped))"
  echo "backend: $("$ROOT/scripts/backend.sh" status | head -1)"
}

shot() {
  require_up
  local file="$EVIDENCE/$1.png"
  if [ "$PLATFORM" = ios ]; then
    xcrun simctl io "$DEVICE" screenshot "$file" >/dev/null 2>&1
  else
    adb_device exec-out screencap -p >"$file"
  fi
  echo "$file"
}

record() {
  require_up
  local name="$1"
  RECORD_PID="$(node - "$PLATFORM" "$DEVICE" "$ADB" "$SERIAL" "$name" "$EVIDENCE" "$STATE_DIR" "$(hash_of "$ROOT")" <<'JS'
const { spawn } = require("node:child_process");
const { openSync, closeSync } = require("node:fs");
const [platform, device, adb, serial, name, evidence, state, owner] = process.argv.slice(2);
const output = openSync(`${state}/${platform}.recording.log`, "w");
const command = platform === "ios" ? "xcrun" : adb;
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const androidCommand = `screenrecord --bit-rate 8000000 ${quote(`/sdcard/${name}.mp4`)} & recording_pid=$!; echo "$recording_pid" > /data/local/tmp/rodge-recording-${owner}.pid; wait "$recording_pid"`;
const args = platform === "ios"
  ? ["simctl", "io", device, "recordVideo", "--codec", "h264", "--force", `${evidence}/${name}.mp4`]
  : ["-s", serial, "shell", androidCommand];
const child = spawn(command, args, { detached: true, stdio: ["ignore", output, output] });
child.unref();
closeSync(output);
console.log(child.pid);
JS
)"
  echo "$name" >"$STATE_DIR/$PLATFORM.recording"
  save
  sleep 1
  echo "recording $name; scripts/sim.sh$(flag) stop when done"
}

stop() {
  require_up
  if [ -n "$RECORD_PID" ]; then
    if [ "$PLATFORM" = android ]; then
      local remote_pid
      remote_pid="$(adb_device shell cat "/data/local/tmp/rodge-recording-$(hash_of "$ROOT").pid" 2>/dev/null | tr -d '\r' || true)"
      # Leave the Device panel's separate screenrecord process alone.
      if [[ "$remote_pid" =~ ^[0-9]+$ ]]; then
        adb_device shell kill -INT "$remote_pid" >/dev/null 2>&1 || true
      fi
    else
      kill -INT "$RECORD_PID" 2>/dev/null || true
    fi
    while kill -0 "$RECORD_PID" 2>/dev/null; do sleep 0.2; done
  fi
  RECORD_PID=""
  save
  local name
  name="$(cat "$STATE_DIR/$PLATFORM.recording" 2>/dev/null || true)"
  if [ "$PLATFORM" = android ] && [ -n "$name" ]; then
    sleep 1
    # Stream the finished file through the shell. The emulator's adb sync
    # transfer can disconnect just after screenrecord exits.
    local transferred=0 expected actual
    for _ in 1 2 3; do
      expected="$(adb_device shell stat -c %s "/sdcard/$name.mp4" 2>/dev/null | tr -d '\r' || true)"
      if adb_device exec-out cat "/sdcard/$name.mp4" >"$EVIDENCE/$name.mp4.partial"; then
        actual="$(wc -c <"$EVIDENCE/$name.mp4.partial" | tr -d ' ')"
        if [ "$actual" = "$expected" ] && [ "$actual" != 0 ]; then
          mv "$EVIDENCE/$name.mp4.partial" "$EVIDENCE/$name.mp4"
          transferred=1
          break
        fi
      fi
      sleep 2
    done
    [ "$transferred" = 1 ] || return 1
    adb_device shell rm "/sdcard/$name.mp4"
    adb_device shell rm -f "/data/local/tmp/rodge-recording-$(hash_of "$ROOT").pid"
  fi
  rm -f "$STATE_DIR/$PLATFORM.recording"
  [ -n "$name" ] && echo "$EVIDENCE/$name.mp4"
}

down() {
  load
  local closed="${DEVICE:+$([ "$PLATFORM" = ios ] && echo "$DEVICE" || echo "$SERIAL")}"
  if [ -n "$RECORD_PID" ]; then kill -INT "$RECORD_PID" 2>/dev/null || true; fi
  if [ "$PLATFORM" = ios ] && [ -n "$DEVICE" ]; then
    xcrun simctl shutdown "$DEVICE" 2>/dev/null || true
    xcrun simctl delete "$DEVICE" 2>/dev/null || true
  elif [ "$PLATFORM" = android ] && [ -n "$DEVICE" ]; then
    [ -n "$SERIAL" ] && adb_device emu kill >/dev/null 2>&1 || true
    if [ -n "$EMULATOR_PID" ]; then
      while kill -0 "$EMULATOR_PID" 2>/dev/null; do sleep 0.5; done
    fi
    "$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" -s delete avd -n "$DEVICE" >/dev/null 2>&1 || true
  fi
  DEVICE="" SERIAL="" EMULATOR_PID="" RECORD_PID=""
  save
  rm -f "$STATE_DIR/$PLATFORM"
  queue release "$PLATFORM" || true
  echo "$PLATFORM device stopped"
  [ -n "$closed" ] && echo "close it in T3's Device panel too if it's open there: device_close $closed"
  release_metro
}

frames() {
  require_up
  local report=""
  case "${1:-}" in
    start)
      queue perf-start "$PLATFORM"
      if app_eval "globalThis.rodgeDev.frames.start()" >/dev/null; then
        echo "recording frames"
      else
        queue perf-stop "$PLATFORM" || true
        exit 1
      fi
      ;;
    stop)
      if app_eval "globalThis.rodgeDev.frames.stop()" >/dev/null; then
        for _ in $(seq 1 20); do
          report="$(app_eval "globalThis.rodgeDev.frames.report()")" || break
          [ -n "$report" ] && echo "$report" && break
          sleep 0.25
        done
      fi
      # A crashed app must still release its measurement slot.
      queue perf-stop "$PLATFORM" || true
      [ -n "$report" ] || exit 1
      ;;
    *) echo "usage: scripts/sim.sh frames start|stop" >&2 && exit 2 ;;
  esac
}

command="${1:-status}"
shift || true
# The state file's mtime is when this worktree last used its device; the
# queue shuts down devices unused for a while when others are waiting.
case "$command" in
  up | down | queue) ;;
  *) [ -f "$STATE_DIR/$PLATFORM" ] && touch "$STATE_DIR/$PLATFORM" ;;
esac
case "$command" in
  build) ensure_client && echo "$CLIENT" ;;
  # Internal: ensure_client runs it under the heavy-work lock.
  build-client) (cd "$MOBILE" && "build_${PLATFORM}_client" "${1:?artifact}") ;;
  up) up ;;
  open) require_up && open_path "${1:?path}" ;;
  eval) require_up && app_eval "${1:?expression}" ;;
  frames) frames "${1:-}" ;;
  relaunch) require_up && launch && echo "relaunched" ;;
  shot) shot "${1:?name}" ;;
  record) record "${1:?name}" ;;
  stop) stop ;;
  reload) require_up && app_eval "globalThis.rodgeDev.reload()" ;;
  signin)
    require_up
    if [ ! -f "$ROOT/.cache/backend/isolated" ]; then
      echo "sign-in needs an isolated backend: scripts/backend.sh isolate (docs/simulator-sign-in.md)" >&2
      exit 1
    fi
    front
    app_eval "globalThis.rodgeDev.signIn()" >/dev/null
    for _ in $(seq 1 30); do
      result="$(app_eval "globalThis.rodgeDev.signInStatus()" | tr -d '"')"
      [ "$result" != pending ] && break
      sleep 1
    done
    echo "$result"
    [[ "$result" == "signed in"* ]]
    ;;
  status) status ;;
  queue) queue status ;;
  down) down ;;
  *)
    sed -n '2,49p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
