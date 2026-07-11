import type { MailAccountFilter, ThreadSelection } from "../store";
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
  initialAccountFilter,
  initialSelection,
}: {
  children?: React.ReactNode;
  initialInbox: InboxMessage[];
  initialAccountFilter: MailAccountFilter;
  initialSelection?: ThreadSelection;
}) {
  return (
    <MailStore
      initialAccountFilter={initialAccountFilter}
      initialSelection={initialSelection}
    >
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
    <main className="mail-atmosphere bg-background text-foreground relative flex h-dvh min-h-0 overflow-hidden">
      <AccountRail />
      <div className="relative z-10 flex min-w-0 flex-1 p-0 md:p-3">
        <div className="mail-workspace flex min-w-0 flex-1 overflow-hidden border md:rounded-[18px]">
          <InboxPane />
          <ReaderPane />
        </div>
      </div>
      <ComposeDialog />
      <OutboxStatus />
    </main>
  );
}
