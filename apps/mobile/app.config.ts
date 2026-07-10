import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Rodge Mail",
  slug: "rodge-mail",
  scheme: "rodge-mail",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    associatedDomains: ["webcredentials:rodge-mail.vercel.app"],
    bundleIdentifier: "com.bentsignal.rodgemail",
    supportsTablet: true,
    icon: "./assets/rounded-icon.png",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.bentsignal.rodgemail",
    icon: "./assets/rounded-icon.png",
  },
  experiments: {
    tsconfigPaths: true,
    typedRoutes: true,
    reactCompiler: true,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    "expo-system-ui",
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "16.4",
          usePrecompiledModules: false,
        },
      },
    ],
    "./expo-plugins/with-ios-scene-lifecycle.cjs",
    "./expo-plugins/with-ios-pods-deployment-target.cjs",
    [
      "expo-image-picker",
      {
        photosPermission:
          "Allow Rodge Mail to access photos you choose to attach to email.",
      },
    ],
    "./expo-plugins/with-android-user-certs.cjs",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#f4f1ea",
        image: "./assets/rounded-icon.png",
        dark: {
          backgroundColor: "#111513",
          image: "./assets/rounded-icon.png",
        },
      },
    ],
  ],
});
