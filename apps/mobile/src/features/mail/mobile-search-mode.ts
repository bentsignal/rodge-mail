export function isTemporaryIos27SearchEnabled(
  platform: string,
  enabled: boolean,
) {
  return platform === "ios" && enabled;
}
