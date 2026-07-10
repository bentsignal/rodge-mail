import convexPlugin from "@convex-dev/eslint-plugin";
import { defineConfig } from "eslint/config";

import { baseConfig, strictConfig } from "@rodge-mail/eslint-config/base";
import { convexConfig } from "@rodge-mail/eslint-config/convex";
import { createStrictSyntax } from "@rodge-mail/eslint-config/syntax";

export default defineConfig(
  {
    ignores: ["src/_generated/**"],
  },
  baseConfig,
  strictConfig,
  convexConfig,
  createStrictSyntax({ ts: true }),
  ...convexPlugin.configs.recommended,
);
