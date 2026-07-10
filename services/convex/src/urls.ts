import { createUrls } from "@rodge-mail/config/urls";

import { env } from "./convex.env";

const configuredUrls = createUrls({
  nodeEnv: env.ENVIRONMENT === "production" ? "production" : "development",
});

export const urls = {
  ...configuredUrls,
  convex: {
    cloud: env.CONVEX_CLOUD_URL,
    site: env.CONVEX_SITE_URL,
  },
};
