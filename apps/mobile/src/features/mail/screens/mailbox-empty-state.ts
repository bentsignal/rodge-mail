import type { MobileMailbox } from "../store";
import type { MailboxFilter } from "./mailbox-controls";

export function getEmptyMailboxCopy({
  filter,
  mailbox,
  searchTerm,
}: {
  filter: MailboxFilter;
  mailbox: MobileMailbox;
  searchTerm?: string;
}) {
  if (searchTerm) {
    return {
      detail: `Nothing matched “${searchTerm}”. Try a sender or a shorter subject.`,
      title: "No matching mail",
    };
  }
  if (filter === "unread") {
    return {
      detail: "Everything in this view has been read.",
      title: "No unread messages",
    };
  }
  if (mailbox === "archive") {
    return {
      detail: "Conversations you archive stay here for 30 days.",
      title: "Archive is empty",
    };
  }
  if (mailbox === "spam") {
    return {
      detail:
        "Messages Rodge Mail flags as spam are quarantined here, away from your inbox.",
      title: "No spam",
    };
  }
  return {
    detail: "New mail will appear here in the order it arrives.",
    title: "You are caught up",
  };
}
