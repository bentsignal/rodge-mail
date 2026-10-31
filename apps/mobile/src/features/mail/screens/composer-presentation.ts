import { parseRecipientList } from "@rodge-mail/features/mail";

import type { MobileMailAccount } from "../lib/convex-mail";

export function getComposerAccountLabel(
  account: Pick<MobileMailAccount, "address" | "label">,
) {
  if (account.label === account.address) return account.address;
  return `${account.label} · ${account.address}`;
}

const SEPARATORS = /[,;\n]/u;

export function splitRecipientTokens(value: string) {
  return value
    .split(SEPARATORS)
    .map((token) => token.trim())
    .filter(Boolean);
}

/**
 * Typing a comma, a semicolon, a return, or a space after a complete
 * address turns the text into recipient tokens.
 */
export function takeRecipientTokens(text: string) {
  if (SEPARATORS.test(text)) {
    return { pending: "", tokens: splitRecipientTokens(text) };
  }
  const trimmed = text.trim();
  if (
    text.endsWith(" ") &&
    !trimmed.includes("<") &&
    !trimmed.includes(" ") &&
    parseRecipientList(trimmed).recipients.length === 1
  ) {
    return { pending: "", tokens: [trimmed] };
  }
  return { pending: text, tokens: [] };
}

export function joinRecipientTokens(tokens: string[], pending: string) {
  return [...tokens, pending.trim()].filter(Boolean).join(", ");
}

export function getRecipientToken(token: string) {
  const recipient = parseRecipientList(token).recipients[0];
  if (!recipient) return { label: token, valid: false };
  return { label: recipient.name ?? recipient.address, valid: true };
}

export function getCollapsedRecipientSummary(fromAddress: string | undefined) {
  return fromAddress ? `Cc/Bcc, From: ${fromAddress}` : "Cc/Bcc";
}
