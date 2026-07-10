import { worktreeId as overrideWorktreeId } from "./overrides";
import { normalizeWorktreeId } from "./worktrees";

const APP_TITLE = "Rodge Mail";

export function createPageTitle() {
  const worktreeId = normalizeWorktreeId(overrideWorktreeId);
  return [worktreeId, APP_TITLE].filter(Boolean).join(" · ");
}
