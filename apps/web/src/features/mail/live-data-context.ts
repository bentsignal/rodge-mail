import { createContext } from "react";

import type { LiveMailContextValue } from "./live-data-types";

export const LiveMailContext = createContext<LiveMailContextValue | undefined>(
  undefined,
);
