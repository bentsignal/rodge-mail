import { describe, expect, it } from "vitest";

import {
  CLASSIFICATION_OUTPUT_SCHEMA_VERSION,
  CLASSIFICATION_PROMPT_VERSION,
} from "./constants";
import { isRetryableRuleFallback } from "./retryPolicy";

const fallback = {
  error: "OpenAI response did not include structured output text",
  outputSchemaVersion: CLASSIFICATION_OUTPUT_SCHEMA_VERSION,
  promptVersion: CLASSIFICATION_PROMPT_VERSION,
  recoveryAttemptedAt: undefined,
  source: "rules",
  status: "classified",
};

describe("bounded classification fallback retry", () => {
  it.each([
    "OpenAI response did not include structured output text",
    "Unterminated string in JSON at position 42",
    "Unexpected end of JSON input",
    "Expected ',' or '}' after property value in JSON",
  ])("retries output truncation once: %s", (error) => {
    expect(isRetryableRuleFallback({ ...fallback, error })).toBe(true);
  });

  it("does not retry a recovered fallback forever", () => {
    expect(
      isRetryableRuleFallback({ ...fallback, recoveryAttemptedAt: 1 }),
    ).toBe(false);
  });

  it("does not retry model results, old prompts, or content errors", () => {
    expect(isRetryableRuleFallback({ ...fallback, source: "model" })).toBe(
      false,
    );
    expect(isRetryableRuleFallback({ ...fallback, promptVersion: "old" })).toBe(
      false,
    );
    expect(
      isRetryableRuleFallback({ ...fallback, error: "Invalid API key" }),
    ).toBe(false);
  });
});
