import { defineConfig } from "eslint/config";

import { baseConfig, strictConfig } from "@rodge-mail/eslint-config/base";
import { reactConfig } from "@rodge-mail/eslint-config/react";
import { createStrictSyntax } from "@rodge-mail/eslint-config/syntax";

export default defineConfig(
  {
    ignores: [".tanstack/**", ".output/**", "dist/**", "src/routeTree.gen.ts"],
  },
  baseConfig,
  reactConfig,
  strictConfig,
  createStrictSyntax({ ts: true, react: true, web: true, env: true }),
);
