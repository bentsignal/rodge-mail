export const MAX_RECENT_OUTBOX_PER_UNRESOLVED_STATUS = 25;
export const MAX_RECENT_SENT_OUTBOX = 10;

export function mergeRecentOutboxes<T extends { createdAt: number }>(
  groups: readonly (readonly T[])[],
) {
  const merged = groups.flatMap((group) => [...group]);
  return merged.sort((left, right) => right.createdAt - left.createdAt);
}
