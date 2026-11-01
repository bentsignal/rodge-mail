import { useState } from "react";

export interface AccountPageCache<T> {
  pages: ReadonlyMap<string, T[]>;
  writePage: (key: string, rows: T[]) => void;
}

export function useAccountPageCache<T>() {
  const [pages, setPages] = useState(() => new Map<string, T[]>());
  return {
    pages,
    writePage: (key: string, rows: T[]) => {
      setPages((current) =>
        current.get(key) === rows ? current : new Map(current).set(key, rows),
      );
    },
  };
}
