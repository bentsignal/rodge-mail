import { useState } from "react";
import { useConvexAuth } from "convex/react";

interface AuthSnapshot {
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useStableAuthState() {
  const auth = useConvexAuth();
  const [lastResolved, setLastResolved] = useState<boolean | undefined>(() =>
    auth.isLoading ? undefined : auth.isAuthenticated,
  );

  if (!auth.isLoading && lastResolved !== auth.isAuthenticated) {
    setLastResolved(auth.isAuthenticated);
  }

  return {
    isAuthenticated: lastResolved ?? false,
    isInitialLoading: lastResolved === undefined,
  };
}

export function resolveStableAuthState(
  auth: AuthSnapshot,
  lastResolved: boolean | undefined,
) {
  const resolved = auth.isLoading ? lastResolved : auth.isAuthenticated;
  return {
    isAuthenticated: resolved ?? false,
    isInitialLoading: resolved === undefined,
    lastResolved: resolved,
  };
}
