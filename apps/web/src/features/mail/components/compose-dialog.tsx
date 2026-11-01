import { useId, useState } from "react";
import { ArrowUp, Paperclip, X } from "lucide-react";

import { MAX_ATTACHMENT_COUNT } from "@rodge-mail/convex/attachments/constants";
import * as Dialog from "@rodge-mail/ui-web/dialog";

import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";
import {
  ComposeAccountField,
  getSendingAccount,
} from "./compose-account-field";
import { DraftAttachments } from "./compose-attachment-list";
import { ComposeRow } from "./compose-row";
import { useComposeSend } from "./use-compose-send";

export function ComposeDialog() {
  const composerIsOpen = useMailStore((store) => store.composerIsOpen);
  const closeComposer = useMailStore((store) => store.closeComposer);

  return (
    <Dialog.Container
      onOpenChange={(open) => {
        if (!open) closeComposer();
      }}
      open={composerIsOpen}
    >
      <Dialog.Content
        className="bg-background top-auto! right-0! bottom-0! left-0! flex h-[calc(100dvh-1rem)] max-w-none! translate-x-0! translate-y-0! flex-col gap-0 overflow-hidden rounded-t-[20px] border p-0 sm:right-5! sm:bottom-5! sm:left-auto! sm:h-[min(640px,calc(100dvh-2.5rem))] sm:w-[min(640px,calc(100vw-2.5rem))] sm:rounded-[16px]"
        showCloseButton={false}
      >
        <ComposeContent />
      </Dialog.Content>
    </Dialog.Container>
  );
}

function ComposeContent() {
  const draft = useMailStore((store) => store.composerDraft);
  const updateDraft = useMailStore((store) => store.updateComposerDraft);
  const { attachFiles, canSend, recipientErrors, send } = useComposeSend();

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(event) => {
        if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
        event.preventDefault();
        send();
      }}
    >
      <ComposeHeader
        canSend={canSend}
        onAttach={(files) => void attachFiles(files)}
        onSend={send}
      />
      <div className="mail-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
        <ComposeField
          autoFocus={!draft.to}
          error={recipientErrors.to}
          label="To"
          onChange={(value) => updateDraft("to", value)}
          value={draft.to}
        />
        <CopiesAndSender recipientErrors={recipientErrors} />
        <ComposeField
          label="Subject"
          onChange={(value) => updateDraft("subject", value)}
          value={draft.subject}
        />
        <DraftAttachments />
        <textarea
          aria-label="Message body"
          autoFocus={Boolean(draft.to)}
          className="min-h-[240px] flex-1 resize-none bg-transparent px-5 pt-4 pb-6 text-[15px] leading-6 outline-none"
          onChange={(event) => updateDraft("body", event.target.value)}
          value={draft.body}
        />
      </div>
    </div>
  );
}

function ComposeHeader({
  canSend,
  onAttach,
  onSend,
}: {
  canSend: boolean;
  onAttach: (files: File[]) => void;
  onSend: () => void;
}) {
  const closeComposer = useMailStore((store) => store.closeComposer);
  const subject = useMailStore((store) => store.composerDraft.subject);

  return (
    <header className="border-border flex h-14 shrink-0 items-center gap-1 border-b-[0.5px] pr-3 pl-2">
      <button
        aria-label="Close"
        className="mail-icon-button flex size-9 items-center justify-center rounded-full transition"
        onClick={closeComposer}
        title="Close (Esc)"
        type="button"
      >
        <X className="size-4" />
      </button>
      <Dialog.Title className="min-w-0 flex-1 truncate px-1 text-[15px] font-semibold">
        {subject.trim() || "New Message"}
      </Dialog.Title>
      <Dialog.Description className="sr-only">
        Write a new email message.
      </Dialog.Description>
      <AttachButton onAttach={onAttach} />
      <button
        aria-keyshortcuts="Meta+Enter"
        className="mail-primary-button ml-1 flex h-8 items-center gap-1.5 rounded-full pr-3 pl-3.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-35"
        disabled={!canSend}
        onClick={onSend}
        title="Send (⌘↩)"
        type="button"
      >
        Send
        <ArrowUp className="size-3.5" strokeWidth={2.5} />
      </button>
    </header>
  );
}

function AttachButton({ onAttach }: { onAttach: (files: File[]) => void }) {
  const inputId = useId();
  const attachmentCount = useMailStore(
    (store) => store.composerDraft.attachments.length,
  );

  return (
    <>
      <input
        className="sr-only"
        disabled={attachmentCount >= MAX_ATTACHMENT_COUNT}
        id={inputId}
        multiple
        onChange={(event) => {
          onAttach(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
        type="file"
      />
      <label
        className="mail-icon-button flex size-9 cursor-pointer items-center justify-center rounded-full transition"
        htmlFor={inputId}
        title="Attach files"
      >
        <Paperclip className="size-4" />
        <span className="sr-only">Attach files</span>
      </label>
    </>
  );
}

/** Cc, Bcc, and From fold into one row until clicked, like Mail. */
function CopiesAndSender({
  recipientErrors,
}: {
  recipientErrors: { bcc?: string; cc?: string };
}) {
  const draft = useMailStore((store) => store.composerDraft);
  const updateDraft = useMailStore((store) => store.updateComposerDraft);
  const composerAccountId = useMailStore((store) => store.composerAccountId);
  const { accounts } = useLiveMail();
  const account = getSendingAccount(accounts, composerAccountId);
  const [isExpanded, setIsExpanded] = useState(
    () => draft.cc.trim().length > 0 || draft.bcc.trim().length > 0,
  );
  const [focusCopies, setFocusCopies] = useState(false);

  if (!isExpanded) {
    return (
      <ComposeRow>
        <button
          className="text-muted-foreground hover:text-foreground h-11 min-w-0 flex-1 truncate text-left text-[15px] transition-colors"
          onClick={() => {
            setIsExpanded(true);
            setFocusCopies(true);
          }}
          type="button"
        >
          {getCollapsedSummary(account?.address)}
        </button>
      </ComposeRow>
    );
  }

  return (
    <>
      <ComposeField
        autoFocus={focusCopies}
        error={recipientErrors.cc}
        label="Cc"
        onChange={(value) => updateDraft("cc", value)}
        value={draft.cc}
      />
      <ComposeField
        error={recipientErrors.bcc}
        label="Bcc"
        onChange={(value) => updateDraft("bcc", value)}
        value={draft.bcc}
      />
      <ComposeAccountField />
    </>
  );
}

function getCollapsedSummary(fromAddress: string | undefined) {
  return fromAddress ? `Cc/Bcc, From: ${fromAddress}` : "Cc/Bcc";
}

function ComposeField({
  autoFocus,
  error,
  label,
  onChange,
  value,
}: {
  autoFocus?: boolean;
  error?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <ComposeRow error={error}>
      <label className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="text-muted-foreground shrink-0 text-[15px]">
          {label}:
        </span>
        <input
          aria-invalid={error ? true : undefined}
          autoFocus={autoFocus}
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      </label>
    </ComposeRow>
  );
}
