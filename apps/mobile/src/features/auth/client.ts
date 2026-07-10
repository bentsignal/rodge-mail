import { expoPasskeyClient } from "expo-better-auth-passkey";
import * as SecureStore from "expo-secure-store";
import { expoClient } from "@better-auth/expo/client";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ConvexReactClient } from "convex/react";

import { createUrls } from "@rodge-mail/config/urls";

const urls = createUrls({
  nodeEnv: __DEV__ ? "development" : "production",
});

export const authClient = createAuthClient({
  baseURL: urls.convex.site,
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
