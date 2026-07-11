import type { ClassificationCategory } from "./constants";

export type StoredClassificationCategory =
  | ClassificationCategory
  | "unclassified";

export interface ClassificationMetadata {
  category: StoredClassificationCategory;
  confidence: number;
  importance: number;
  reason: string;
  shouldEmbed: boolean;
  summary: string;
}

interface PreviousClassificationMetadata {
  category?: StoredClassificationCategory;
  confidence: number;
  importance: number;
  reason?: string;
  shouldEmbed: boolean;
  summary?: string;
}

const PENDING_REASON = "Awaiting importance classification";

export function pendingClassificationMetadata(
  previous: PreviousClassificationMetadata | null | undefined,
  messageSnippet: string,
) {
  const source = previous ?? {
    confidence: 0,
    importance: 0,
    shouldEmbed: false,
  };
  return {
    category: definedOr(source.category, "unclassified"),
    confidence: source.confidence,
    importance: source.importance,
    reason: definedOr(source.reason, PENDING_REASON),
    shouldEmbed: source.shouldEmbed,
    summary: definedOr(source.summary, messageSnippet).slice(0, 280),
  } satisfies ClassificationMetadata;
}

export function requiredClassificationMetadata(
  classification: Partial<ClassificationMetadata>,
  messageSnippet: string,
) {
  return {
    category: definedOr(classification.category, "unclassified"),
    reason: definedOr(classification.reason, PENDING_REASON),
    summary: definedOr(classification.summary, messageSnippet).slice(0, 280),
  } satisfies Pick<ClassificationMetadata, "category" | "reason" | "summary">;
}

function definedOr<T>(value: T | undefined, fallback: T) {
  return value ?? fallback;
}
