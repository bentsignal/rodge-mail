import {
  CLASSIFICATION_OUTPUT_SCHEMA_VERSION,
  CLASSIFICATION_PROMPT_VERSION,
} from "./constants";

const RETRYABLE_OUTPUT_ERROR =
  /structured output text|Unterminated|Unexpected end of JSON|after property value/iu;

export function isRetryableRuleFallback(args: {
  error?: string;
  outputSchemaVersion?: string;
  promptVersion: string;
  recoveryAttemptedAt?: number;
  source: string;
  status: string;
}) {
  return (
    args.status === "classified" &&
    args.source === "rules" &&
    args.promptVersion === CLASSIFICATION_PROMPT_VERSION &&
    args.outputSchemaVersion === CLASSIFICATION_OUTPUT_SCHEMA_VERSION &&
    args.recoveryAttemptedAt === undefined &&
    args.error !== undefined &&
    RETRYABLE_OUTPUT_ERROR.test(args.error)
  );
}
