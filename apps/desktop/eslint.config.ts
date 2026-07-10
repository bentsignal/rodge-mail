import { defineConfig } from "eslint/config";

import { baseConfig, strictConfig } from "@rodge-mail/eslint-config/base";
import { createStrictSyntax } from "@rodge-mail/eslint-config/syntax";

export default defineConfig(
  {
    ignores: [
      "out/**",
      "release/**",
      "resources/embedded-web-bootstrap.mjs",
      "src/preload/index.ts",
    ],
  },
  baseConfig,
  strictConfig,
  createStrictSyntax({ ts: true, env: true }),
);
