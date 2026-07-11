import type { ThreadSelection } from "../store";
import type { InboxMessage } from "../types";
import { LiveMailProvider } from "../live-data";
import { MailStore } from "../store";
import { AccountRail } from "./account-rail";
import { ComposeDialog } from "./compose-dialog";
import { InboxPane } from "./inbox-pane";
import { MailDataErrorBoundary } from "./mail-data-error-boundary";
import { OutboxStatus } from "./outbox-status";
import { ReaderPane } from "./reader-pane";

export function MailShell({
  children,
  initialInbox,
  initialSelection,
}: {
  children?: React.ReactNode;
  initialInbox: InboxMessage[];
  initialSelection?: ThreadSelection;
}) {
  return (
    <MailStore initialSelection={initialSelection}>
      <MailDataErrorBoundary>
        <LiveMailProvider initialInbox={initialInbox}>
          {children}
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
      <OutboxStatus />
    </main>
  );
}
