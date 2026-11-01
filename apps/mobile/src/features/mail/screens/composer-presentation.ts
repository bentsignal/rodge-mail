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
 * address turns the text into recipient tokens. Text with a separator in the
 * middle (still being typed) waits for the next one, or for blur.
 */
export function takeRecipientTokens(text: string) {
  if (/[,;\n]\s*$/u.test(text)) {
    return { pending: "", tokens: splitRecipientTokens(text) };
  }
  const trimmed = text.trim();
  if (
    text.endsWith(" ") &&
    !SEPARATORS.test(trimmed) &&
    !trimmed.includes("<") &&
    !trimmed.includes(" ") &&
    parseRecipientList(trimmed).recipients.length === 1
  ) {
    return { pending: "", tokens: [trimmed] };
  }
  return { pending: text, tokens: [] };
}

export function addRecipientTokens(current: string[], added: string[]) {
  const seen = new Set(current.map((token) => token.toLowerCase()));
  const next = [...current];
  for (const token of added) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(token);
  }
  return next;
}

export function joinRecipientTokens(tokens: string[], pending: string) {
  return [...tokens, pending.trim()].filter(Boolean).join(", ");
}

export function getRecipientToken(token: string) {
  const recipient = parseRecipientList(token).recipients[0];
  if (!recipient) return { label: token, valid: false };
  return { label: recipient.name ?? recipient.address, valid: true };
}
