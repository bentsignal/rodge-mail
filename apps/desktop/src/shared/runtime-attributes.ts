export function getDesktopRuntimeAttributes(platform = process.platform) {
  return {
    desktopPlatform: platform,
    desktopRuntime: "true",
  };
}
