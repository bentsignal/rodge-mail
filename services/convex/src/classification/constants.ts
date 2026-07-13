export const CLASSIFICATION_PROMPT_VERSION = "mail-screen-v5";
export const CLASSIFICATION_OUTPUT_SCHEMA_VERSION = "classification-v4";
export const CLEAN_VIEW_PROMPT_VERSION = "clean-view-v1";
export const CLEAN_VIEW_OUTPUT_SCHEMA_VERSION = "clean-view-v1";
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
  isSpam: boolean;
}

export interface CleanViewResult {
  schemaVersion: typeof CLEAN_VIEW_OUTPUT_SCHEMA_VERSION;
  summary: string;
  cleanedMarkdown: string;
}
