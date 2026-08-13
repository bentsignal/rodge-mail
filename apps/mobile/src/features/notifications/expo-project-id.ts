import Constants from "expo-constants";

export function getExpoProjectId() {
  // eslint-disable-next-line no-restricted-syntax -- Expo exposes extra as any, so narrow it from unknown before access.
  const extra: unknown = Constants.expoConfig?.extra;
  if (isRecord(extra) && isRecord(extra.eas)) {
    const projectId = extra.eas.projectId;
    if (typeof projectId === "string" && projectId) return projectId;
  }
  return Constants.easConfig?.projectId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
