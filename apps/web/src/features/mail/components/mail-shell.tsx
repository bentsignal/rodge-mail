import { useRouterState } from "@tanstack/react-router";

import type { MailAccountFilter, ThreadSelection } from "../store";
import type { InboxMessage } from "../types";
import { LiveMailProvider } from "../live-data";
import { MailStore } from "../store";
import { AccountRail } from "./account-rail";
import { ArchivePage } from "./archive-page";
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
  initialUnreadOnly,
}: {
  children?: React.ReactNode;
  initialInbox: InboxMessage[];
  initialAccountFilter: MailAccountFilter;
  initialSelection?: ThreadSelection;
  initialUnreadOnly: boolean;
}) {
  return (
    <MailStore
      initialAccountFilter={initialAccountFilter}
      initialSelection={initialSelection}
      initialUnreadOnly={initialUnreadOnly}
    >
      <MailDataErrorBoundary>
        <LiveMailProvider
          initialAccountFilter={initialAccountFilter}
          initialInbox={initialInbox}
          initialUnreadOnly={initialUnreadOnly}
        >
          {children}
          <MailWorkspace />
        </LiveMailProvider>
      </MailDataErrorBoundary>
    </MailStore>
  );
}

function MailWorkspace() {
  const isArchive = useRouterState({
    select: (state) => state.location.pathname === "/archive",
  });
  return (
    <main className="mail-shell mail-atmosphere bg-background text-foreground relative flex h-dvh min-h-0 overflow-hidden">
      <div className="mail-app-frame relative z-10 flex min-w-0 flex-1 overflow-hidden">
        <AccountRail />
        <div className="mail-workspace flex min-w-0 flex-1 overflow-hidden">
          <MailWorkspaceContent isArchive={isArchive} />
        </div>
      </div>
      <ComposeDialog />
      <OutboxStatus />
    </main>
  );
}

function MailWorkspaceContent({ isArchive }: { isArchive: boolean }) {
  if (isArchive) return <ArchivePage />;
  return (
    <>
      <InboxPane />
      <ReaderPane />
    </>
  );
}
