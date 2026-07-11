/* eslint-disable @typescript-eslint/consistent-type-assertions -- Convex upload responses contain runtime-validated branded storage IDs. */
import { useId, useState } from "react";
import { useMutation } from "convex/react";
import { ArrowUp, Paperclip, Send, X } from "lucide-react";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";
import {
  getProviderAttachmentError,
  MAX_ATTACHMENT_COUNT,
} from "@rodge-mail/convex/attachments/constants";
import { parseRecipientFields } from "@rodge-mail/features/mail";
import * as Dialog from "@rodge-mail/ui-web/dialog";
import { Textarea } from "@rodge-mail/ui-web/textarea";
import { toast } from "@rodge-mail/ui-web/toast";

import { useLiveMail } from "../live-data";
import { useMailStore } from "../store";
import {
  ComposeAccountField,
  getSendingAccount,
} from "./compose-account-field";
import { DraftAttachments, getUploadSummary } from "./compose-attachment-list";
import { useComposeAttachments } from "./use-compose-attachments";

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
        className="mail-workspace top-auto! right-0! bottom-0! left-0! flex h-[calc(100dvh-1rem)] max-w-none! translate-x-0! translate-y-0! flex-col gap-0 overflow-hidden rounded-t-[20px] border p-0 sm:right-5! sm:bottom-5! sm:left-auto! sm:h-[min(720px,calc(100dvh-2.5rem))] sm:w-[min(720px,calc(100vw-2.5rem))] sm:rounded-[18px]"
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
        <ComposeAccountField />
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
          label="Bcc"
          onChange={(value) => updateDraft("bcc", value)}
          placeholder="Optional"
          value={draft.bcc}
        />
        <ComposeField
          label="Subject"
          onChange={(value) => updateDraft("subject", value)}
          placeholder="What is this about?"
          value={draft.subject}
        />
        <Textarea
          aria-label="Message body"
          className="min-h-[310px] border-0 bg-transparent px-0 py-6 font-serif text-[18px] leading-8 shadow-none placeholder:text-[var(--mail-ink-soft)] focus-visible:ring-0"
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
    <header className="mail-chassis flex h-16 shrink-0 items-center border-b px-5">
      <div>
        <Dialog.Title className="font-serif text-xl font-semibold tracking-[-0.02em]">
          New message
        </Dialog.Title>
        <Dialog.Description className="sr-only">
          Write a new email message.
        </Dialog.Description>
      </div>
      <button
        aria-label="Close new message"
        className="ml-auto flex size-9 items-center justify-center rounded-[9px] border border-white/10 text-[var(--mail-chassis-foreground)]/70 transition hover:bg-white/10 hover:text-[var(--mail-chassis-foreground)]"
        onClick={closeComposer}
        type="button"
      >
        <X className="size-4" />
      </button>
    </header>
  );
}

function ComposeFooter() {
  const attachmentInputId = useId();
  const canSend = useMailStore((store) => store.composerCanSend);
  const completeEnqueue = useMailStore(
    (store) => store.completeComposerEnqueue,
  );
  const composerAccountId = useMailStore((store) => store.composerAccountId);
  const replyToMessageId = useMailStore(
    (store) => store.composerReplyToMessageId,
  );
  const draft = useMailStore((store) => store.composerDraft);
  const idempotencyKey = useMailStore((store) => store.idempotencyKey);
  const enqueuePlainText = useMutation(api.mail.mutations.enqueuePlainText);
  const { accounts } = useLiveMail();
  const account = getSendingAccount(accounts, composerAccountId);
  const [isSending, setIsSending] = useState(false);
  const { attachFiles, attachmentsAreReady } = useComposeAttachments(
    account?.provider,
  );

  async function send() {
    if (!account) {
      toast.error("Connect a mail account before sending.");
      return;
    }
    const attachmentError = getProviderAttachmentError(
      account.provider,
      draft.attachments,
    );
    if (attachmentError) {
      toast.error(attachmentError);
      return;
    }
    if (!attachmentsAreReady) {
      toast.error("Wait for every attachment to finish uploading.");
      return;
    }
    const parsedRecipients = getValidRecipients(draft);
    if (!parsedRecipients) return;
    setIsSending(true);
    try {
      const result = await enqueuePlainText({
        accountId: account._id,
        idempotencyKey,
        to: parsedRecipients.recipients.to,
        cc: parsedRecipients.recipients.cc,
        bcc: parsedRecipients.recipients.bcc,
        subject: draft.subject.trim(),
        plainText: draft.body,
        replyToMessageId,
        attachmentIds: draft.attachments.map((attachment) =>
          toDraftAttachmentId(requireDraftAttachmentId(attachment)),
        ),
      });
      setIsSending(false);
      completeEnqueue();
      toast.success(getEnqueueSuccessMessage(result.status));
    } catch (error) {
      toast.error(getSendError(error));
      setIsSending(false);
    }
  }

  return (
    <footer className="mail-paper-soft flex shrink-0 items-center gap-2 border-t border-[var(--mail-seam)] px-5 py-3.5 shadow-[0_-2px_7px_rgba(55,40,19,0.07)] sm:px-7">
      <input
        className="sr-only"
        id={attachmentInputId}
        multiple
        disabled={draft.attachments.length >= MAX_ATTACHMENT_COUNT}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          void attachFiles(files);
          event.target.value = "";
        }}
        type="file"
      />
      <label
        className="mail-icon-button flex size-9 cursor-pointer items-center justify-center rounded-[9px] transition"
        htmlFor={attachmentInputId}
        title="Attach files"
      >
        <Paperclip className="size-4" />
        <span className="sr-only">Attach files</span>
      </label>
      <span className="mail-label font-mono text-[8px] tracking-[0.12em] uppercase">
        {getUploadSummary(draft.attachments)}
      </span>
      <button
        className="mail-brass-button ml-auto flex h-10 items-center gap-2 rounded-[9px] px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canSend || !attachmentsAreReady || isSending}
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

function getEnqueueSuccessMessage(status: "pending" | "sending" | "sent") {
  if (status === "sent") return "Message already delivered.";
  if (status === "sending") return "Message delivery is already in progress.";
  return "Message queued for delivery.";
}

function getValidRecipients(draft: { bcc: string; cc: string; to: string }) {
  const result = parseRecipientFields(draft);
  const error = getRecipientError(result);
  if (!error) return result;
  toast.error(error);
  return undefined;
}

function toDraftAttachmentId(value: string) {
  return value as Id<"draftAttachments">;
}

function requireDraftAttachmentId(attachment: {
  draftAttachmentId?: string;
  fileName: string;
}) {
  if (!attachment.draftAttachmentId) {
    throw new Error(`${attachment.fileName} has not finished uploading.`);
  }
  return attachment.draftAttachmentId;
}

function getRecipientError(result: ReturnType<typeof parseRecipientFields>) {
  const errors = new Array<string>();
  for (const [field, label] of [
    ["to", "To"],
    ["cc", "CC"],
    ["bcc", "BCC"],
  ] as const) {
    const invalid = result.invalid[field];
    if (invalid.length > 0) {
      errors.push(`${label}: invalid ${invalid.join(", ")}`);
    }
  }
  if (result.recipients.to.length === 0 && result.invalid.to.length === 0) {
    errors.push("To: add at least one valid email address");
  }
  return errors.length > 0 ? errors.join(". ") : undefined;
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
    <label className="flex min-h-12 items-center gap-4 border-b border-[var(--mail-seam)]">
      <span className="mail-label w-12 shrink-0 font-mono text-[9px] tracking-[0.14em] uppercase">
        {label}
      </span>
      <input
        autoFocus={autoFocus}
        className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--mail-ink-soft)]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}
