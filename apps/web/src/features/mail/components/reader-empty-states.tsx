import { MailOpen } from "lucide-react";

export function ReaderSkeleton() {
  return (
    <div aria-label="Loading thread" className="animate-pulse">
      <div className="border-border/70 h-[68px] border-b" />
      <div className="mx-auto max-w-[780px] space-y-5 px-9 pt-12">
        <div className="h-2.5 w-32 rounded-full bg-[var(--mail-paper-deep)]" />
        <div className="h-10 w-4/5 rounded-xl bg-[var(--mail-paper-soft)] shadow-[var(--mail-shadow-inset)]" />
        <div className="mt-9 h-px bg-[var(--mail-seam)]" />
        <div className="mt-8 flex gap-3">
          <div className="size-10 rounded-[11px] bg-[var(--mail-avatar)] shadow-[var(--mail-shadow-raised)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-36 rounded-full bg-[var(--mail-paper-deep)]" />
            <div className="h-2.5 w-64 rounded-full bg-[var(--mail-paper-soft)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmptyReader() {
  return (
    <div className="mail-label flex flex-1 flex-col items-center justify-center px-8 text-center">
      <span className="mail-inset mb-5 flex size-14 items-center justify-center rounded-[13px] border">
        <MailOpen className="size-5" strokeWidth={1.5} />
      </span>
      <p className="text-foreground font-serif text-xl font-semibold">
        Select a message
      </p>
      <p className="mt-1.5 max-w-xs text-sm leading-6">
        The message will open here.
      </p>
    </div>
  );
}
