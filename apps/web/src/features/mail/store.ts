import { useState } from "react";
import { createStore } from "rostra";

import type { Id } from "@rodge-mail/convex/model";
import type { ComposerDraft, InboxCategory } from "@rodge-mail/features/mail";

export type MailAccountFilter = "all" | Id<"mailAccounts">;

interface ThreadSelection {
  messageId: Id<"messages">;
  threadId: Id<"threads">;
}

interface ReplyTarget {
  address: string;
  subject: string;
}

function createEmptyDraft() {
  return {
    attachments: [],
    body: "",
    cc: "",
    subject: "",
    to: "",
  };
}

function useComposerState() {
  const [composerIsOpen, setComposerIsOpen] = useState(false);
  const [composerDraft, setComposerDraft] =
    useState<ComposerDraft>(createEmptyDraft);
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

  function addComposerAttachments(fileNames: string[]) {
    setComposerDraft((current) => ({
      ...current,
      attachments: [...new Set([...current.attachments, ...fileNames])],
    }));
  }

  function openReply({ address, subject }: ReplyTarget) {
    setComposerDraft({
      ...createEmptyDraft(),
      subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
      to: address,
    });
    setComposerIsOpen(true);
    setIdempotencyKey(createIdempotencyKey());
  }

  function sendComposerDraft() {
    if (!composerCanSend) return;
    setDeliveryNotice(
      `Message queued for ${composerDraft.to}.`,
    );
    setComposerIsOpen(false);
    setComposerDraft(createEmptyDraft());
    setIdempotencyKey(createIdempotencyKey());
  }

  return {
    addComposerAttachments,
    closeComposer: () => setComposerIsOpen(false),
    composerCanSend,
    composerDraft,
    composerIsOpen,
    idempotencyKey,
    deliveryNotice,
    dismissDeliveryNotice: () => setDeliveryNotice(undefined),
    openComposer: () => {
      setComposerDraft(createEmptyDraft());
      setIdempotencyKey(createIdempotencyKey());
      setComposerIsOpen(true);
    },
    openReply,
    removeComposerAttachment: (fileName: string) =>
      setComposerDraft((current) => ({
        ...current,
        attachments: current.attachments.filter((name) => name !== fileName),
      })),
    sendComposerDraft,
    updateComposerDraft,
  };
}

function createIdempotencyKey() {
  return `rodge-web-${crypto.randomUUID()}`;
}

function useInternalStore() {
  const [accountFilter, setAccountFilterState] =
    useState<MailAccountFilter>("all");
  const [category, setCategoryState] = useState<InboxCategory>("focused");
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

  function setCategory(category: InboxCategory) {
    setCategoryState(category);
    setSearchQuery("");
    resetSelection();
  }

  function selectThread(nextSelection: ThreadSelection) {
    setSelection(nextSelection);
    setMobileReaderIsOpen(true);
  }

  return {
    ...composer,
    accountFilter,
    category,
    closeMobileReader: () => setMobileReaderIsOpen(false),
    mobileReaderIsOpen,
    searchQuery,
    selectThread,
    selectedMessageId: selection?.messageId,
    selectedThreadId: selection?.threadId,
    setAccountFilter,
    setCategory,
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
