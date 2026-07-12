export function getAccountButtonLabel(
  label: string,
  count: number | undefined,
) {
  if (!count) return label;
  return `${label}, ${count} unread`;
}
