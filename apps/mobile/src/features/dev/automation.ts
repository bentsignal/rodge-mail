import type { Href } from "expo-router";
import { DevSettings } from "react-native";
import { router } from "expo-router";

import { authClient, convexUrls } from "~/features/auth/client";
import { frameReport, startFrames, stopFrames } from "./frames";

const PRODUCTION_DEPLOYMENT = "dazzling-dog-633";

function isAppPath(path: string): path is Href & string {
  return path.startsWith("/");
}

/**
 * Isolated backends only (`scripts/backend.sh isolate`): signs in as the
 * deployment's test owner through its dev-only `/dev/sign-in` route, which
 * production doesn't have. The Expo auth client stores the session cookie
 * as it does after any sign-in.
 */
async function signIn() {
  if (
    convexUrls.cloud.includes(PRODUCTION_DEPLOYMENT) ||
    convexUrls.site.includes(PRODUCTION_DEPLOYMENT)
  ) {
    throw new Error(
      "This app talks to the production deployment; run scripts/backend.sh isolate first",
    );
  }
  const { data, error } = await authClient.$fetch<{ email: string }>(
    "/dev/sign-in",
    { method: "POST", body: {} },
  );
  if (error) throw new Error(error.message ?? error.statusText);
  return data.email;
}

/**
 * Debug builds only: lets `scripts/sim.sh` navigate, reload, sign in, and
 * measure frames over Metro's debugger connection. iOS asks "Open in Rodge
 * Mail?" before every `simctl openurl`, which scripts cannot answer.
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
      signIn,
      frames: { report: frameReport, start: startFrames, stop: stopFrames },
    },
  });
}
