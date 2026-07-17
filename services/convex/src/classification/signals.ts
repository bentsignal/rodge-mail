import type { ClassificationResult, ClassificationSignal } from "./constants";
import type { NormalizedMail } from "./normalize";
import { CLASSIFICATION_OUTPUT_SCHEMA_VERSION } from "./constants";

const DETECTORS = [
  detectPinned,
  detectOutgoing,
  detectActionLanguage,
  detectNewsletter,
  detectAutomatedSender,
  detectBulkMail,
  detectTransactional,
  detectAttachment,
];

export function deriveSignals(mail: NormalizedMail) {
  return DETECTORS.map((detector) => detector(mail)).filter(isSignal);
}

export function deterministicClassification(
  mail: NormalizedMail,
  signals: ClassificationSignal[],
) {
  const score = signals.reduce((total, signal) => total + signal.weight, 0);
  const category = inferCategory(mail, signals);
  const topSignals = [...signals]
    .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight))
    .slice(0, 3);
  return {
    schemaVersion: CLASSIFICATION_OUTPUT_SCHEMA_VERSION,
    category,
    importance: clamp(0.5 + score / 2),
    confidence: clamp(0.58 + Math.abs(score) / 3),
    reason:
      topSignals.map((signal) => signal.explanation).join("; ") ||
      "No strong priority signals were detected.",
    isSpam: false,
  } satisfies ClassificationResult;
}

function detectPinned(mail: NormalizedMail) {
  return mail.isPinned ? signal("pinned", 0.9, "Pinned by the user") : null;
}

function detectOutgoing(mail: NormalizedMail) {
  return mail.direction === "outgoing"
    ? signal("outgoing", 0.55, "Part of a conversation the user sent")
    : null;
}

function detectActionLanguage(mail: NormalizedMail) {
  return /\b(action required|approval|approve|deadline|due|please review|respond|reply|rsvp|urgent)\b/iu.test(
    `${mail.subject} ${mail.snippet}`,
  )
    ? signal("action_language", 0.55, "Contains a concrete request or deadline")
    : null;
}

function detectNewsletter(mail: NormalizedMail) {
  const hasListHeader = mail.headers.some((header) =>
    ["list-id", "list-unsubscribe"].includes(header.name),
  );
  return hasListHeader
    ? signal("mailing_list", -0.65, "Sent through a mailing list")
    : null;
}

function detectAutomatedSender(mail: NormalizedMail) {
  return /\b(no-?reply|do-?not-?reply|notifications?|mailer-daemon)\b/iu.test(
    `${mail.from.name ?? ""} ${mail.from.address}`,
  )
    ? signal("automated_sender", -0.4, "Sent from an automated address")
    : null;
}

function detectBulkMail(mail: NormalizedMail) {
  const bulk = mail.headers.some(
    (header) =>
      header.name === "precedence" &&
      /\b(bulk|list|junk)\b/iu.test(header.value),
  );
  return bulk ? signal("bulk_precedence", -0.55, "Marked as bulk mail") : null;
}

function detectTransactional(mail: NormalizedMail) {
  return /\b(receipt|invoice|order|shipped|delivery|statement|verification|security code|password)\b/iu.test(
    `${mail.subject} ${mail.snippet}`,
  )
    ? signal("transactional", -0.05, "Looks like a transactional update")
    : null;
}

function detectAttachment(mail: NormalizedMail) {
  return mail.hasAttachments
    ? signal("attachment", 0.1, "Includes an attachment")
    : null;
}

function inferCategory(mail: NormalizedMail, signals: ClassificationSignal[]) {
  const codes = new Set(signals.map((item) => item.code));
  if (codes.has("action_language")) return "action_required";
  if (codes.has("mailing_list")) return "newsletter";
  if (codes.has("transactional")) return "transactional";
  if (codes.has("automated_sender") || codes.has("bulk_precedence")) {
    return "notification";
  }
  if (mail.direction === "outgoing") return "personal";
  return signals.length === 0 ? "noise" : "personal";
}

function signal(code: string, weight: number, explanation: string) {
  return { code, weight, explanation };
}

function isSignal(
  value: ClassificationSignal | null,
): value is ClassificationSignal {
  return value !== null;
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}
