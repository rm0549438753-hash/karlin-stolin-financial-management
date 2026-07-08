import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Serve cached data instantly for 60s; avoids re-fetching on
        // every navigation while still keeping data reasonably fresh.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload route + loader data on link hover/focus for snappier navigation.
    defaultPreload: "intent",
    // Reuse cached loader data for 30s on preload/navigation.
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
