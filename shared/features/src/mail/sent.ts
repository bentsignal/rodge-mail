export type SentStatus = "failed" | "pending" | "sending" | "sent";

export function getSentStatusLabel(status: SentStatus) {
  if (status === "pending") return "Queued";
  if (status === "sending") return "Sending";
  if (status === "failed") return "Not sent";
  return "Sent";
}

export function formatSentRecipients(
  recipients: readonly { address: string; name?: string }[],
  maxNames = 2,
) {
  const names = recipients.map((recipient) => {
    const name = recipient.name?.trim();
    if (!name) return recipient.address;
    return name;
  });
  if (names.length === 0) return "No recipients";
  const shown = names.slice(0, maxNames).join(", ");
  const hidden = names.length - maxNames;
  return hidden > 0 ? `${shown} +${hidden}` : shown;
}

export function formatRecipientAddresses(
  recipients: readonly { address: string; name?: string }[],
) {
  return recipients
    .map((recipient) =>
      recipient.name?.trim()
        ? `${recipient.name.trim()} <${recipient.address}>`
        : recipient.address,
    )
    .join(", ");
}

export function getSentSubject(subject: string) {
  return subject.trim() || "(no subject)";
}
