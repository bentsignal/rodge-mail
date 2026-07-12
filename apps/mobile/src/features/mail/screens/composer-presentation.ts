import type { MobileMailAccount } from "../lib/convex-mail";

export function getComposerAccountLabel(
  account: Pick<MobileMailAccount, "address" | "label">,
) {
  if (account.label === account.address) return account.address;
  return `${account.label} · ${account.address}`;
}

export function getEnqueueConfirmation(status: "pending" | "sending" | "sent") {
  if (status === "sent") {
    return {
      message: "This message has been delivered.",
      title: "Message already delivered",
    };
  }
  if (status === "sending") {
    return {
      message: "Rodge Mail is sending it in the background.",
      title: "Delivery already in progress",
    };
  }
  return {
    message: "Rodge Mail will send it in the background.",
    title: "Message queued",
  };
}
