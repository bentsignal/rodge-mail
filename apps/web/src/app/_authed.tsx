import {
  createFileRoute,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";

import { api } from "@rodge-mail/convex/api";

import type { ThreadSelection } from "~/features/mail/store";
import { MailShell } from "~/features/mail/components/mail-shell";
import { MAIL_PAGE_SIZE } from "~/features/mail/constants";

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
  loader: async ({ context }) => {
    const [, initialInbox] = await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.accounts.queries.list, {}),
      ),
      context.convexHttpClient.query(api.mail.queries.listInbox, {
        paginationOpts: { cursor: null, numItems: MAIL_PAGE_SIZE },
      }),
    ]);
    return { initialInbox: initialInbox.page };
  },
  staleTime: 30_000,
});

function MailLayout() {
  const initialInbox = Route.useLoaderData({
    select: (data) => data.initialInbox,
  });
  const initialSelection = useRouterState({
    select: (state) => {
      const messageMatch = state.matches.find(
        (match) => match.routeId === "/_authed/messages/$messageId",
      );
      return isThreadSelection(messageMatch?.loaderData)
        ? messageMatch.loaderData
        : undefined;
    },
  });

  return (
    <MailShell initialInbox={initialInbox} initialSelection={initialSelection}>
      <Outlet />
    </MailShell>
  );
}

function isThreadSelection(value: unknown): value is ThreadSelection {
  if (typeof value !== "object" || value === null) return false;
  return "messageId" in value && "threadId" in value;
}
