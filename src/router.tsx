import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep already-fetched data on screen while it refreshes in the
        // background: screens re-open instantly instead of re-loading.
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        // Keep default refetchOnMount (true): fresh data is still served from
        // cache thanks to staleTime, but a query invalidated while unmounted
        // (e.g. lookups edited in Settings) refetches when the screen re-opens.
        refetchOnMount: true,

        refetchOnReconnect: true,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
