import type { Href } from "expo-router";
import { DevSettings } from "react-native";
import { router } from "expo-router";

import { frameReport, startFrames, stopFrames } from "./frames";

function isAppPath(path: string): path is Href & string {
  return path.startsWith("/");
}

/**
 * Debug builds only: lets `scripts/sim.sh` navigate, reload, and measure
 * frames over Metro's debugger connection. iOS asks "Open in Rodge Mail?"
 * before every `simctl openurl`, which scripts cannot answer.
 */
export function installDevAutomation() {
  if (!__DEV__) return;
  Object.assign(globalThis, {
    rodgeDev: {
      open(path: string) {
        if (!path.startsWith("/")) throw new Error(`Not an app path: ${path}`);
        if (isAppPath(path)) router.push(path);
      },
      reload() {
        DevSettings.reload();
      },
      frames: { report: frameReport, start: startFrames, stop: stopFrames },
    },
  });
}
