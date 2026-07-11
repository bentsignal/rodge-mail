export function getPlatformWindowOptions(platform = process.platform) {
  if (platform !== "darwin") return {};

  return {
    titleBarOverlay: true,
    titleBarStyle: "hiddenInset" as const,
    trafficLightPosition: { x: 14, y: 16 },
  };
}
