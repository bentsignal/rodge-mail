import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useRef, useState } from "react";

import { appendToHeldRows } from "../lib/next-page";

/** How long after a drag ends without a fling the list counts as resting. */
const SETTLE_MS = 120;

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

/**
 * Keeps a list's rows from moving under the finger: while it's dragged or
 * still coasting, it keeps showing the rows it had when the drag began,
 * plus any appended below them (the next page), and takes every other
 * change at once when it comes to rest. Scrolled down from the top, rows
 * added or removed above keep the ones on screen in place; at the top, a
 * new row shows there. `rowsPending` says whether rows are waiting.
 */
export function useSteadyData<Item>(
  data: readonly Item[] | undefined,
  keyOf: (item: Item) => string,
) {
  const [held, setHeld] = useState<readonly Item[]>();
  const [scrolled, setScrolled] = useState(false);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const shown =
    held === undefined ? undefined : appendToHeldRows(held, data ?? [], keyOf);
  const rows = shown?.rows ?? data;
  function rest() {
    clearTimeout(settle.current);
    setHeld(undefined);
  }
  return {
    data: rows,
    rowsPending: shown !== undefined && !shown.hasAllRows,
    listProps: {
      maintainVisibleContentPosition: { data: scrolled },
      onMomentumScrollBegin: () => clearTimeout(settle.current),
      onMomentumScrollEnd: rest,
      onScroll: ({ nativeEvent }: ScrollEvent) => {
        const atTop =
          nativeEvent.contentOffset.y <= 4 - nativeEvent.contentInset.top;
        if (atTop === scrolled) setScrolled(!atTop);
      },
      onScrollBeginDrag: () => {
        clearTimeout(settle.current);
        setHeld(rows ?? []);
      },
      onScrollEndDrag: () => {
        settle.current = setTimeout(rest, SETTLE_MS);
      },
      scrollEventThrottle: 32,
    },
  };
}
