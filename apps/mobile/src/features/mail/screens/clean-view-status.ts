import type { MailMessage } from "@rodge-mail/features/mail";

export function isPreparingCleanView(message: MailMessage) {
  return message.cleanStatus === "pending" || message.cleanStatus === "running";
}

export function hasGeneratedCleanView(message: MailMessage) {
  if (message.cleanStatus === "ready") return true;
  return Boolean(message.cleanedBody?.trim());
}
