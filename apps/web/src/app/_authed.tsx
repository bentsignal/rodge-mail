import { useLayoutEffect } from "react";
import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

import type { MailAccountFilter, ThreadSelection } from "~/features/mail/store";
import { MailShell } from "~/features/mail/components/mail-shell";
import { MAIL_PAGE_SIZE } from "~/features/mail/constants";
import { normalizeMailRouteSearch } from "~/features/mail/mail-route-search";
import { useMailStore } from "~/features/mail/store";

export const Route = createFileRoute("/_authed")({
  component: MailLayout,
  beforeLoad: ({ context, location }) => {
    if (!context.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: { redirect_uri: location.pathname },
      });
    }
    return { isAuthenticated: true };
  },
  loaderDeps: ({ search }) => ({
    accountId: toAccountId(search.mailbox),
    unreadOnly: search.unread === true,
  }),
  loader: async ({ context, deps }) => {
    const [, , initialInbox] = await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.accounts.queries.list, {}),
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.mail.queries.getUnreadCounts, {}),
      ),
      context.convexHttpClient.query(api.mail.queries.listInbox, {
        accountId: deps.accountId,
        paginationOpts: { cursor: null, numItems: MAIL_PAGE_SIZE },
        unreadOnly: deps.unreadOnly,
      }),
    ]);
    return { initialInbox: initialInbox.page };
  },
  staleTime: 30_000,
  validateSearch: normalizeMailRouteSearch,
});

function MailLayout() {
  const initialInbox = Route.useLoaderData({
    select: (data) => data.initialInbox,
  });
  const mailbox = Route.useSearch({ select: (search) => search.mailbox });
  const unreadOnly = Route.useSearch({
    select: (search) => search.unread === true,
  });
  const initialAccountFilter = toAccountFilter(mailbox);
  const initialSelection = useRouterState({
    select: (state) => {
      const messageMatch = state.matches.find(
        (match) =>
          match.routeId === "/_authed/messages/$messageId" ||
          match.routeId === "/_authed/archive/messages/$messageId",
      );
      return isThreadSelection(messageMatch?.loaderData)
        ? messageMatch.loaderData
        : undefined;
    },
  });

  return (
    <MailShell
      initialAccountFilter={initialAccountFilter}
      initialInbox={initialInbox}
      initialSelection={initialSelection}
      initialUnreadOnly={unreadOnly}
    >
      <MailboxRouteSync
        accountFilter={initialAccountFilter}
        unreadOnly={unreadOnly}
      />
      <Outlet />
    </MailShell>
  );
}

function MailboxRouteSync({
  accountFilter,
  unreadOnly,
}: {
  accountFilter: MailAccountFilter;
  unreadOnly: boolean;
}) {
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);
  const setUnreadOnly = useMailStore((store) => store.setUnreadOnly);

  useLayoutEffect(
    () => setAccountFilter(accountFilter),
    [accountFilter, setAccountFilter],
  );
  useLayoutEffect(() => setUnreadOnly(unreadOnly), [setUnreadOnly, unreadOnly]);
  return null;
}

function toAccountId(mailbox: string | undefined) {
  if (!mailbox) return undefined;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Convex validates the route-derived ID at the query boundary.
  return mailbox as Id<"mailAccounts">;
}

function toAccountFilter(mailbox: string | undefined) {
  if (!mailbox) return "all";
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- The Convex query validates route-derived IDs at the data boundary.
  return mailbox as Exclude<MailAccountFilter, "all">;
}

function isThreadSelection(value: unknown): value is ThreadSelection {
  if (typeof value !== "object" || value === null) return false;
  return "messageId" in value && "threadId" in value;
}
