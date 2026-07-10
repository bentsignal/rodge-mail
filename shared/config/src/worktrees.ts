export function normalizeWorktreeId(worktreeId: string | undefined) {
  const slug = worktreeId
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    return undefined;
  }

  const shortId = /(?:^|-)([a-f0-9]{7,12})$/.exec(slug);
  return shortId?.[1] ?? slug;
}
