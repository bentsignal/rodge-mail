export const LEGACY_EMBEDDING_REASONS = ["focused", "inbox"] as const;

export function legacyEmbeddingCleanupPlan(args: {
  currentClassification: boolean;
  messageExists: boolean;
  protectedReason: boolean;
}) {
  return args.messageExists &&
    (args.currentClassification || args.protectedReason)
    ? ("reconcile" as const)
    : ("delete" as const);
}
