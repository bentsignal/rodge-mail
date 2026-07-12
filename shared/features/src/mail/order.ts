interface PinnableMailRow {
  isPinned: boolean;
  receivedAt: number | string;
}

export function sortPinnedMailRows<T extends PinnableMailRow>(rows: T[]) {
  return rows.slice().sort((left, right) => {
    if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
    return toTimestamp(right.receivedAt) - toTimestamp(left.receivedAt);
  });
}

function toTimestamp(value: number | string) {
  return typeof value === "number" ? value : Date.parse(value);
}
