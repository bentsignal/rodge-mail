import { createUrls } from "@rodge-mail/config/urls";

import { env } from "~/env";

export const urls = createUrls({
  nodeEnv: env.VITE_NODE_ENV,
});
