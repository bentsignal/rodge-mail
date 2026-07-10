const configuredWebUrl = process.env.RODGE_WEB_URL?.trim();

export const desktopEnv = {
  webUrl: configuredWebUrl || undefined,
};
