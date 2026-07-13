export const CLASSIFICATION_PROMPT_VERSION = "clean-mail-v4";
export const CLASSIFICATION_OUTPUT_SCHEMA_VERSION = "classification-v3";
export const DEFAULT_CLASSIFICATION_MODEL = "gpt-5-nano";
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 512;
export const MAX_JOB_ATTEMPTS = 3;

export type ClassificationCategory =
  | "personal"
  | "action_required"
  | "transactional"
  | "newsletter"
  | "notification"
  | "noise";

export type EmbeddingReason =
  | "focused"
  | "important"
  | "inbox"
  | "pinned"
  | "selected";

export interface ClassificationSignal {
  code: string;
  explanation: string;
  weight: number;
}

export interface ClassificationResult {
  schemaVersion: typeof CLASSIFICATION_OUTPUT_SCHEMA_VERSION;
  category: ClassificationCategory;
  importance: number;
  confidence: number;
  reason: string;
  summary: string;
  cleanedMarkdown: string;
  isSpam: boolean;
}
