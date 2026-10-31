import type { Href } from "expo-router";
import { DevSettings } from "react-native";
import { router } from "expo-router";

import { authClient, convexUrls } from "~/features/auth/client";
import { devMailActions } from "./dev-mail-actions";
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
async function requestSignIn() {
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

let signInStatus = "idle";

/**
 * Starts sign-in and returns at once: Hermes' debugger crashes the app when
 * `sim-eval` awaits a promise, so `scripts/sim.sh signin` polls
 * `signInStatus()` instead.
 */
function signIn() {
  if (signInStatus === "pending") return signInStatus;
  signInStatus = "pending";
  requestSignIn().then(
    (email) => (signInStatus = `signed in as ${email}`),
    (error: unknown) =>
      (signInStatus = `failed: ${error instanceof Error ? error.message : String(error)}`),
  );
  return signInStatus;
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
      signInStatus: () => signInStatus,
      frames: { report: frameReport, start: startFrames, stop: stopFrames },
      /** The inbox's rows by index: `mail.pin(0)`, `archive`, `read`; `select()` toggles selection mode. */
      mail: {
        archive: (index: number) => devMailActions()?.archive(index),
        pin: (index: number) => devMailActions()?.pin(index),
        read: (index: number) => devMailActions()?.read(index),
        select: () => devMailActions()?.select(),
      },
    },
  });
}
