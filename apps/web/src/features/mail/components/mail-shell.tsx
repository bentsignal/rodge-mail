import { LiveMailProvider } from "../live-data";
import { MailStore, useMailStore } from "../store";
import { AccountRail } from "./account-rail";
import { ComposeDialog } from "./compose-dialog";
import { InboxPane } from "./inbox-pane";
import { MailDataErrorBoundary } from "./mail-data-error-boundary";
import { ReaderPane } from "./reader-pane";

export function MailShell() {
  return (
    <MailStore>
      <MailDataErrorBoundary>
        <LiveMailProvider>
          <MailWorkspace />
        </LiveMailProvider>
      </MailDataErrorBoundary>
    </MailStore>
  );
}

function MailWorkspace() {
  return (
    <main className="mail-atmosphere bg-background text-foreground relative flex h-dvh min-h-[640px] overflow-hidden">
      <AccountRail />
      <div className="relative z-10 flex min-w-0 flex-1 p-0 md:p-2.5 md:pl-0">
        <div className="border-border/70 bg-card/92 flex min-w-0 flex-1 overflow-hidden border shadow-[0_24px_80px_rgba(48,38,24,0.10)] backdrop-blur-xl md:rounded-[22px]">
          <InboxPane />
          <ReaderPane />
        </div>
      </div>
      <ComposeDialog />
      <DeliveryNotice />
    </main>
  );
}

function DeliveryNotice() {
  const notice = useMailStore((store) => store.deliveryNotice);
  const dismiss = useMailStore((store) => store.dismissDeliveryNotice);

  if (!notice) return null;

  return (
    <div className="animate-in slide-in-from-bottom-3 fixed right-5 bottom-5 z-50 flex items-center gap-3 rounded-full bg-[#20251f] py-2.5 pr-2.5 pl-4 text-sm text-[#f7f1e6] shadow-2xl duration-300">
      <span className="size-1.5 rounded-full bg-[#d77a55]" />
      <span>{notice}</span>
      <button
        className="rounded-full px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-[#d8d0c2] uppercase hover:bg-white/10"
        onClick={dismiss}
        type="button"
      >
        Dismiss
      </button>
    </div>
  );
}
