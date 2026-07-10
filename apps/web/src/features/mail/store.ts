import { useState } from "react";
import { createStore } from "rostra";

import type { Id } from "@rodge-mail/convex/model";
import type {
  ComposerAttachment,
  ComposerDraft,
} from "@rodge-mail/features/mail";

export type MailAccountFilter = "all" | Id<"mailAccounts">;

interface ThreadSelection {
  messageId: Id<"messages">;
  threadId: Id<"threads">;
}

interface ReplyTarget {
  accountId: Id<"mailAccounts">;
  address: string;
  internetMessageId?: string;
  subject: string;
}

export interface WebComposerAttachment extends ComposerAttachment {
  file: File;
}

function createEmptyDraft() {
  return {
    attachments: [],
    body: "",
    cc: "",
    subject: "",
    to: "",
  } satisfies ComposerDraft<WebComposerAttachment>;
}

function useComposerState() {
  const [composerIsOpen, setComposerIsOpen] = useState(false);
  const [composerDraft, setComposerDraft] =
    useState<ComposerDraft<WebComposerAttachment>>(createEmptyDraft);
  const [composerAccountId, setComposerAccountId] =
    useState<Id<"mailAccounts">>();
  const [
    composerReplyToInternetMessageId,
    setComposerReplyToInternetMessageId,
  ] = useState<string>();
  const [deliveryNotice, setDeliveryNotice] = useState<string>();
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const composerCanSend =
    composerDraft.to.trim().length > 0 &&
    (composerDraft.subject.trim().length > 0 ||
      composerDraft.body.trim().length > 0);

  function updateComposerDraft(
    field: "body" | "cc" | "subject" | "to",
    value: string,
  ) {
    setComposerDraft((current) => ({ ...current, [field]: value }));
  }

  function addComposerAttachments(attachments: WebComposerAttachment[]) {
    setComposerDraft((current) => ({
      ...current,
      attachments: [...current.attachments, ...attachments],
    }));
  }

  function updateComposerAttachment(
    attachmentId: string,
    update: Partial<WebComposerAttachment>,
  ) {
    setComposerDraft((current) => ({
      ...current,
      attachments: current.attachments.map((attachment) =>
        attachment.id === attachmentId
          ? { ...attachment, ...update }
          : attachment,
      ),
    }));
  }

  function openReply({
    accountId,
    address,
    internetMessageId,
    subject,
  }: ReplyTarget) {
    setComposerDraft({
      ...createEmptyDraft(),
      subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
      to: address,
    });
    setComposerAccountId(accountId);
    setComposerReplyToInternetMessageId(internetMessageId);
    setComposerIsOpen(true);
    setIdempotencyKey(createIdempotencyKey());
  }

  function sendComposerDraft() {
    if (!composerCanSend) return;
    setDeliveryNotice(`Message queued for ${composerDraft.to}.`);
    setComposerIsOpen(false);
    setComposerDraft(createEmptyDraft());
    setComposerReplyToInternetMessageId(undefined);
    setIdempotencyKey(createIdempotencyKey());
  }

  return {
    addComposerAttachments,
    closeComposer: () => setComposerIsOpen(false),
    composerCanSend,
    composerAccountId,
    composerDraft,
    composerIsOpen,
    composerReplyToInternetMessageId,
    idempotencyKey,
    deliveryNotice,
    dismissDeliveryNotice: () => setDeliveryNotice(undefined),
    openComposer: () => {
      setComposerDraft(createEmptyDraft());
      setComposerReplyToInternetMessageId(undefined);
      setIdempotencyKey(createIdempotencyKey());
      setComposerIsOpen(true);
    },
    openReply,
    removeComposerAttachment: (attachmentId: string) =>
      setComposerDraft((current) => ({
        ...current,
        attachments: current.attachments.filter(
          (attachment) => attachment.id !== attachmentId,
        ),
      })),
    sendComposerDraft,
    setComposerAccountId,
    updateComposerAttachment,
    updateComposerDraft,
  };
}

function createIdempotencyKey() {
  return `rodge-web-${crypto.randomUUID()}`;
}

function useInternalStore() {
  const [accountFilter, setAccountFilterState] =
    useState<MailAccountFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selection, setSelection] = useState<ThreadSelection>();
  const [mobileReaderIsOpen, setMobileReaderIsOpen] = useState(false);
  const composer = useComposerState();

  function resetSelection() {
    setSelection(undefined);
    setMobileReaderIsOpen(false);
  }

  function setAccountFilter(accountFilter: MailAccountFilter) {
    setAccountFilterState(accountFilter);
    resetSelection();
  }

  function selectThread(nextSelection: ThreadSelection) {
    setSelection(nextSelection);
    setMobileReaderIsOpen(true);
  }

  return {
    ...composer,
    accountFilter,
    closeMobileReader: () => setMobileReaderIsOpen(false),
    mobileReaderIsOpen,
    searchQuery,
    selectThread,
    selectedMessageId: selection?.messageId,
    selectedThreadId: selection?.threadId,
    setAccountFilter,
    setInitialSelection: (nextSelection: ThreadSelection) =>
      setSelection((current) => current ?? nextSelection),
    setSearchQuery: (query: string) => {
      setSearchQuery(query);
      resetSelection();
    },
  };
}

export const { Store: MailStore, useStore: useMailStore } =
  createStore(useInternalStore);
