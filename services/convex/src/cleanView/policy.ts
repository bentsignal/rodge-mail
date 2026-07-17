import type { Doc } from "../_generated/dataModel";

export function shouldAutoGenerateCleanView(args: {
  requested: boolean | undefined;
  isSpam: boolean;
  source: Doc<"messageClassifications">["source"];
}) {
  return args.requested === true && !args.isSpam && args.source === "model";
}

export function shouldRequestAutomaticCleanView(args: {
  messageExists: boolean;
  direction: "incoming" | "outgoing";
  inInbox: boolean;
}) {
  return !args.messageExists && args.direction === "incoming" && args.inInbox;
}

export function canQueueCleanView(
  cleanView:
    | Pick<Doc<"messageCleanViews">, "generatedAt" | "status">
    | null
    | undefined,
) {
  if (!cleanView) return true;
  if (cleanView.generatedAt !== undefined) return false;
  return cleanView.status === "failed";
}
