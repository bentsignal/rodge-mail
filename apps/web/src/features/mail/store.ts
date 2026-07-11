import { useState } from "react";
import { createStore } from "rostra";

import type { Id } from "@rodge-mail/convex/model";
import type {
  ComposerAttachment,
  ComposerDraft,
} from "@rodge-mail/features/mail";
import { useDebouncedInput } from "@rodge-mail/std/use-debounced-input";

const SEARCH_DEBOUNCE_MS = 350;

export type MailAccountFilter = "all" | Id<"mailAccounts">;

export interface ThreadSelection {
  messageId: Id<"messages">;
  threadId: Id<"threads">;
}

interface ReplyTarget {
  accountId: Id<"mailAccounts">;
  address: string;
  messageId: Id<"messages">;
  subject: string;
}

export interface WebComposerAttachment extends ComposerAttachment {
  file: File;
}

type WebComposerDraft = ComposerDraft<WebComposerAttachment>;

function createEmptyDraft() {
  return {
    attachments: [],
    bcc: "",
    body: "",
    cc: "",
    subject: "",
    to: "",
  } satisfies WebComposerDraft;
}

function useComposerState() {
  const [composerIsOpen, setComposerIsOpen] = useState(false);
  const [composerDraft, setComposerDraft] =
    useState<WebComposerDraft>(createEmptyDraft);
  const [composerAccountId, setComposerAccountId] =
    useState<Id<"mailAccounts">>();
  const [composerReplyToMessageId, setComposerReplyToMessageId] =
    useState<Id<"messages">>();
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const composerCanSend =
    composerDraft.to.trim().length > 0 && composerDraft.body.trim().length > 0;

  function updateComposerDraft(
    field: "bcc" | "body" | "cc" | "subject" | "to",
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

  function openReply({ accountId, address, messageId, subject }: ReplyTarget) {
    setComposerDraft({
      ...createEmptyDraft(),
      subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
      to: address,
    });
    setComposerAccountId(accountId);
    setComposerReplyToMessageId(messageId);
    setComposerIsOpen(true);
    setIdempotencyKey(createIdempotencyKey());
  }

  function completeComposerEnqueue() {
    if (!composerCanSend) return;
    setComposerIsOpen(false);
    setComposerDraft(createEmptyDraft());
    setComposerReplyToMessageId(undefined);
    setIdempotencyKey(createIdempotencyKey());
  }

  return {
    addComposerAttachments,
    completeComposerEnqueue,
    closeComposer: () => setComposerIsOpen(false),
    composerCanSend,
    composerAccountId,
    composerDraft,
    composerIsOpen,
    composerReplyToMessageId,
    idempotencyKey,
    openComposer: () => {
      setComposerDraft(createEmptyDraft());
      setComposerReplyToMessageId(undefined);
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
    setComposerAccountId,
    updateComposerAttachment,
    updateComposerDraft,
  };
}

function createIdempotencyKey() {
  return `rodge-web-${crypto.randomUUID()}`;
}

function useInternalStore({
  initialAccountFilter,
  initialSelection,
}: {
  initialAccountFilter: MailAccountFilter;
  initialSelection?: ThreadSelection;
}) {
  const [accountFilter, setAccountFilterState] =
    useState<MailAccountFilter>(initialAccountFilter);
  const {
    debouncedValue: debouncedSearchQuery,
    setValue: setSearchQueryState,
    setValueImmediately: setSearchQueryImmediately,
    value: searchQuery,
  } = useDebouncedInput({ initialValue: "", timeInMs: SEARCH_DEBOUNCE_MS });
  const [selection, setSelection] = useState(initialSelection);
  const [mobileReaderIsOpen, setMobileReaderIsOpen] = useState(
    initialSelection !== undefined,
  );
  const composer = useComposerState();

  function resetSelection() {
    setSelection(undefined);
    setMobileReaderIsOpen(false);
  }

  function setAccountFilter(nextAccountFilter: MailAccountFilter) {
    if (accountFilter === nextAccountFilter) return;
    setAccountFilterState(nextAccountFilter);
    resetSelection();
  }

  function selectThread(nextSelection: ThreadSelection) {
    setSelection(nextSelection);
    setMobileReaderIsOpen(true);
  }

  return {
    ...composer,
    accountFilter,
    clearSelection: resetSelection,
    closeMobileReader: () => setMobileReaderIsOpen(false),
    mobileReaderIsOpen,
    debouncedSearchQuery:
      searchQuery.trim().length === 0 ? "" : debouncedSearchQuery.trim(),
    searchQuery,
    selectThread,
    selectedMessageId: selection?.messageId,
    selectedThreadId: selection?.threadId,
    setAccountFilter,
    setInitialSelection: (nextSelection: ThreadSelection) =>
      setSelection((current) => current ?? nextSelection),
    setSearchQuery: (query: string) => {
      if (query.trim().length === 0) {
        setSearchQueryImmediately(query);
      } else {
        setSearchQueryState(query);
      }
      resetSelection();
    },
  };
}

export const { Store: MailStore, useStore: useMailStore } =
  createStore(useInternalStore);
