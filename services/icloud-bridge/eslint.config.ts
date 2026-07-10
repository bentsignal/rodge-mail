import { defineConfig } from "eslint/config";

import { baseConfig, strictConfig } from "@rodge-mail/eslint-config/base";
import { createStrictSyntax } from "@rodge-mail/eslint-config/syntax";

export default defineConfig(
  { ignores: ["dist/**"] },
  baseConfig,
  strictConfig,
  createStrictSyntax({ ts: true, env: true }),
);
