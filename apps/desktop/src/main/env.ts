const configuredWebUrl = process.env.RODGE_WEB_URL?.trim();

export const desktopEnv = {
  webUrl: configuredWebUrl || undefined,
};

export function createEmbeddedWebEnv(serverEntry: string) {
  return {
    ...process.env,
    HOST: "127.0.0.1",
    NODE_ENV: "production",
    PORT: "0",
    RODGE_EMBEDDED_SERVER_ENTRY: serverEntry,
    VITE_NODE_ENV: "development",
  };
}
