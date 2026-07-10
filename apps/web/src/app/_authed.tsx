import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

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
});

function MailLayout() {
  return <Outlet />;
}
