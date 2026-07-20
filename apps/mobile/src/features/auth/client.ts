import { expoPasskeyClient } from "expo-better-auth-passkey";
import * as SecureStore from "expo-secure-store";
import { expoClient } from "@better-auth/expo/client";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ConvexReactClient } from "convex/react";

import { nativeAuthBasePath } from "@rodge-mail/config/auth";
import { createUrls } from "@rodge-mail/config/urls";

const urls = createUrls({
  nodeEnv: "development",
});

export const authClient = createAuthClient({
  baseURL: urls.convex.site,
  basePath: nativeAuthBasePath,
  plugins: [
    expoClient({
      cookiePrefix: "better-auth",
      scheme: "rodge-mail",
      storage: SecureStore,
      storagePrefix: "rodge-mail",
    }),
    emailOTPClient(),
    expoPasskeyClient(),
    convexClient(),
  ],
});

export const convex = new ConvexReactClient(urls.convex.cloud, {
  expectAuth: true,
  unsavedChangesWarning: false,
});
