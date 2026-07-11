import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const isDevelopmentBuild =
    process.env.EAS_BUILD_PROFILE?.startsWith("development") ??
    process.env.NODE_ENV !== "production";

  return {
    ...config,
    name: "Rodge Mail",
    slug: "rodge-mail",
    owner: "directedbyshawn",
    scheme: "rodge-mail",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/rounded-icon.png",
    userInterfaceStyle: "automatic",
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ["**/*"],
    extra: {
      ...config.extra,
      eas: {
        projectId: "4273bb9c-b86a-419b-8b0a-ac4180f0b9bd",
      },
    },
    ios: {
      associatedDomains: [
        ...(isDevelopmentBuild
          ? ["webcredentials:rodge-mail.local?mode=developer"]
          : []),
        "webcredentials:rodge-mail.vercel.app",
      ],
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
      [
        "expo-notifications",
        {
          color: "#0f2a1c",
          defaultChannel: "new-mail",
        },
      ],
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
          backgroundColor: "#e9d0a0",
          image: "./assets/splash-icon.png",
          dark: {
            backgroundColor: "#0f2a1c",
            image: "./assets/splash-icon.png",
          },
        },
      ],
    ],
  };
};
