/** The production deployment: dev tools never run there, whatever its env. */
export const PRODUCTION_DEPLOYMENT = "dazzling-dog-633";
export const DEV_USER_EMAIL = "alex.rivera@example.com";

export function isDevToolsDeployment(config: {
  devTools: string | undefined;
  environment: string;
  cloudUrl: string;
  siteUrl: string;
}) {
  return (
    config.devTools === "true" &&
    config.environment === "development" &&
    !config.cloudUrl.includes(PRODUCTION_DEPLOYMENT) &&
    !config.siteUrl.includes(PRODUCTION_DEPLOYMENT)
  );
}
