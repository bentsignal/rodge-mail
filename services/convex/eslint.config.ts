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
  {
    files: ["src/**/*.ts"],
    ignores: ["src/_generated/**", "src/utils.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/_generated/server"],
              importNames: ["action", "mutation", "query"],
              message:
                "Use authedAction, authedMutation, or authedQuery from utils for public Convex functions.",
            },
          ],
        },
      ],
    },
  },
);
