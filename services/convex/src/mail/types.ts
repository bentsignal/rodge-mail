import type { Infer } from "convex/values";

import type {
  vClassificationCategory,
  vFocusBucket,
  vMailboxAddress,
  vMailFolderKind,
  vMailProvider,
} from "./validators";

export type MailProvider = Infer<typeof vMailProvider>;
export type MailFolderKind = Infer<typeof vMailFolderKind>;
export type MailboxAddress = Infer<typeof vMailboxAddress>;
export type FocusBucket = Infer<typeof vFocusBucket>;
export type ClassificationCategory = Infer<typeof vClassificationCategory>;
