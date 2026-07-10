import { useId, useState } from "react";
import { useMutation } from "convex/react";
import { ArrowUp, Paperclip, Send, X } from "lucide-react";

import { api } from "@rodge-mail/convex/api";
import * as Dialog from "@rodge-mail/ui-web/dialog";
import { Textarea } from "@rodge-mail/ui-web/textarea";
import { toast } from "@rodge-mail/ui-web/toast";

import type { MailAccountView } from "../types";
import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";

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
        className="top-auto! right-0! bottom-0! left-0! flex h-[calc(100dvh-1rem)] max-w-none! translate-x-0! translate-y-0! flex-col gap-0 overflow-hidden rounded-t-[24px] border-[#cfc4b5] bg-[#fbf8f1] p-0 shadow-[0_-20px_80px_rgba(42,34,25,0.20)] sm:right-5! sm:bottom-5! sm:left-auto! sm:h-[min(720px,calc(100dvh-2.5rem))] sm:w-[min(720px,calc(100vw-2.5rem))] sm:rounded-[24px] dark:border-[#4a4f48] dark:bg-[#252924]"
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

  return (
    <>
      <ComposeHeader />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 sm:px-7">
        <ComposeField
          autoFocus
          label="To"
          onChange={(value) => updateDraft("to", value)}
          placeholder="name@example.com"
          value={draft.to}
        />
        <ComposeField
          label="Cc"
          onChange={(value) => updateDraft("cc", value)}
          placeholder="Optional"
          value={draft.cc}
        />
        <ComposeField
          label="Subject"
          onChange={(value) => updateDraft("subject", value)}
          placeholder="What is this about?"
          value={draft.subject}
        />
        <Textarea
          aria-label="Message body"
          className="min-h-[310px] border-0 px-0 py-6 font-serif text-[18px] leading-8 shadow-none placeholder:text-[#aaa095] focus-visible:ring-0"
          onChange={(event) => updateDraft("body", event.target.value)}
          placeholder="Write simply…"
          value={draft.body}
        />
        <DraftAttachments />
      </div>

      <ComposeFooter />
    </>
  );
}

function ComposeHeader() {
  const closeComposer = useMailStore((store) => store.closeComposer);

  return (
    <header className="flex h-16 shrink-0 items-center border-b border-[#ded5c8] px-5 dark:border-[#41453f]">
      <div>
        <Dialog.Title className="font-serif text-xl font-semibold tracking-[-0.02em]">
          New message
        </Dialog.Title>
        <Dialog.Description className="mt-0.5 font-mono text-[8px] tracking-[0.16em] text-[#8c8174] uppercase">
          Plain text · saved locally
        </Dialog.Description>
      </div>
      <button
        aria-label="Close composer"
        className="ml-auto flex size-9 items-center justify-center rounded-full text-[#84796d] hover:bg-black/[0.05] hover:text-[#20251f] dark:hover:bg-white/[0.06] dark:hover:text-white"
        onClick={closeComposer}
        type="button"
      >
        <X className="size-4" />
      </button>
    </header>
  );
}

function DraftAttachments() {
  const attachments = useMailStore((store) => store.composerDraft.attachments);
  const removeAttachment = useMailStore(
    (store) => store.removeComposerAttachment,
  );
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pb-5">
      {attachments.map((attachment) => (
        <span
          className="flex items-center gap-2 rounded-full border border-[#d4c9bb] bg-white/60 py-1.5 pr-1.5 pl-3 text-xs dark:border-[#484d46] dark:bg-white/[0.035]"
          key={attachment}
        >
          <Paperclip className="size-3 text-[#8f8173]" />
          <span className="max-w-56 truncate">{attachment}</span>
          <button
            aria-label={`Remove ${attachment}`}
            className="flex size-5 items-center justify-center rounded-full hover:bg-black/[0.06]"
            onClick={() => removeAttachment(attachment)}
            type="button"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

function ComposeFooter() {
  const attachmentInputId = useId();
  const addAttachments = useMailStore((store) => store.addComposerAttachments);
  const canSend = useMailStore((store) => store.composerCanSend);
  const completeSend = useMailStore((store) => store.sendComposerDraft);
  const draft = useMailStore((store) => store.composerDraft);
  const idempotencyKey = useMailStore((store) => store.idempotencyKey);
  const enqueuePlainText = useMutation(api.mail.mutations.enqueuePlainText);
  const { accounts, selectedThread } = useLiveMail();
  const [isSending, setIsSending] = useState(false);

  async function send() {
    const account = getSendingAccount(accounts, selectedThread?.accountId);
    if (!account) {
      toast.error("Connect a Gmail or Microsoft 365 account before sending.");
      return;
    }
    if (draft.attachments.length > 0) {
      toast.error("Attachment upload is not connected yet.");
      return;
    }
    const to = parseAddresses(draft.to);
    if (to.length === 0) {
      toast.error("Add at least one valid recipient.");
      return;
    }
    setIsSending(true);
    try {
      await enqueuePlainText({
        accountId: account._id,
        idempotencyKey,
        to,
        cc: parseAddresses(draft.cc),
        subject: draft.subject.trim(),
        plainText: draft.body,
        replyToInternetMessageId:
          selectedThread?.messages.at(-1)?.internetMessageId,
      });
      setIsSending(false);
      completeSend();
      toast.success("Message queued for delivery.");
    } catch (error) {
      toast.error(getSendError(error));
      setIsSending(false);
    }
  }

  return (
    <footer className="flex shrink-0 items-center gap-2 border-t border-[#ded5c8] px-5 py-3.5 sm:px-7 dark:border-[#41453f]">
      <input
        className="sr-only"
        id={attachmentInputId}
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          addAttachments(files.map((file) => file.name));
          event.target.value = "";
        }}
        type="file"
      />
      <label
        className="flex size-9 cursor-pointer items-center justify-center rounded-full text-[#756c63] transition hover:bg-black/[0.05] hover:text-[#20251f] dark:hover:bg-white/[0.06] dark:hover:text-white"
        htmlFor={attachmentInputId}
        title="Attach files"
      >
        <Paperclip className="size-4" />
        <span className="sr-only">Attach files</span>
      </label>
      <span className="font-mono text-[8px] tracking-[0.12em] text-[#968a7d] uppercase">
        Attach anything
      </span>
      <button
        className="ml-auto flex h-10 items-center gap-2 rounded-full bg-[#c76749] px-4 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(169,77,52,0.20)] transition hover:-translate-y-0.5 hover:bg-[#b85a3f] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canSend || isSending}
        onClick={() => void send()}
        type="button"
      >
        <Send className="size-3.5" />
        Send
        <ArrowUp className="size-3" />
      </button>
    </footer>
  );
}

function getSendingAccount(
  accounts: MailAccountView[],
  selectedAccountId: MailAccountView["_id"] | undefined,
) {
  const selected = accounts.find(
    (account) =>
      account._id === selectedAccountId && canSendFromAccount(account),
  );
  return selected ?? accounts.find(canSendFromAccount);
}

function canSendFromAccount(account: MailAccountView) {
  return (
    (account.provider === "gmail" || account.provider === "microsoft") &&
    (account.status === "connected" || account.status === "syncing")
  );
}

function parseAddresses(value: string) {
  return value
    .split(",")
    .map((address) => address.trim().toLowerCase())
    .filter((address) => address.includes("@"))
    .map((address) => ({ address }));
}

function getSendError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Could not queue this message.";
}

function ComposeField({
  autoFocus,
  label,
  onChange,
  placeholder,
  value,
}: {
  autoFocus?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="flex min-h-12 items-center gap-4 border-b border-[#e2dacd] dark:border-[#3f433d]">
      <span className="w-12 shrink-0 font-mono text-[9px] tracking-[0.14em] text-[#887c70] uppercase">
        {label}
      </span>
      <input
        autoFocus={autoFocus}
        className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#aaa095]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}
