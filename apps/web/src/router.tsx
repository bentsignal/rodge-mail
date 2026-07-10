import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexHttpClient } from "convex/browser";
import { ConvexReactClient } from "convex/react";

import { Error } from "~/components/error";
import { NotFound } from "~/components/not-found";
import { Pending } from "~/components/pending";
import { urls } from "~/urls";
import { routeTree } from "./routeTree.gen";

export interface RouterContext {
  convex: ConvexReactClient;
  convexHttpClient: ConvexHttpClient;
  convexQueryClient: ConvexQueryClient;
  queryClient: QueryClient;
}

export function getRouter() {
  const convex = new ConvexReactClient(urls.convex.cloud, {
    expectAuth: true,
  });
  const convexQueryClient = new ConvexQueryClient(convex);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);
  const convexHttpClient = new ConvexHttpClient(urls.convex.cloud);
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    context: {
      convex,
      convexHttpClient,
      queryClient,
      convexQueryClient,
    },
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: Error,
    defaultPendingComponent: Pending,
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
