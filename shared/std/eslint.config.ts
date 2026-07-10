import { defineConfig } from "eslint/config";

import { baseConfig, strictConfig } from "@rodge-mail/eslint-config/base";
import { reactConfig } from "@rodge-mail/eslint-config/react";
import { createStrictSyntax } from "@rodge-mail/eslint-config/syntax";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  strictConfig,
  reactConfig,
  createStrictSyntax({ ts: true, react: true }),
);
