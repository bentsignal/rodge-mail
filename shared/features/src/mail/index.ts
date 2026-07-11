export { DEMO_MAIL_ACCOUNTS, DEMO_MAIL_THREADS } from "./demo";
export { parseEmailText } from "./email-text";
export {
  normalizeRecipientFields,
  normalizeRecipients,
  parseRecipientFields,
  parseRecipientList,
} from "./recipients";
export { getReplyAddress } from "./reply";
export { mergeSearchResults } from "./search";
export { dedupeThreadRows } from "./thread-rows";
export type {
  ComposerAttachment,
  ComposerDraft,
  MailAccount,
  MailAccountFilter,
  MailAccountId,
  MailAddress,
  MailAttachment,
  MailMessage,
  MailProvider,
  MailThread,
} from "./types";
export type { EmailTextBlock, EmailTextInline } from "./email-text";
export type {
  RecipientAddress,
  RecipientFields,
  RecipientFieldsResult,
  RecipientParseResult,
} from "./recipients";
