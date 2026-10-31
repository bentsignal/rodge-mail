import type { LegendListRef } from "@legendapp/list/react-native";
import { useRef } from "react";

import type { PageStatus } from "../lib/next-page";
import {
  getRowsBelow,
  getThresholdRows,
  shouldRequestNextPage,
} from "../lib/next-page";

/**
 * Asks a paginated list for its next page once each time the user nears
 * the end (`shouldRequestNextPage`). Call `request` from the list's end and
 * scroll events, and `resetOnDrag` when the user starts dragging.
 */
export function useNextPage({
  onLoadMore,
  pageStatus,
  rowExtent,
  rowsPending,
}: {
  onLoadMore: () => void;
  pageStatus: PageStatus;
  rowExtent: number;
  rowsPending: boolean;
}) {
  const listRef = useRef<LegendListRef>(null);
  const requestedSinceScroll = useRef(false);
  function request() {
    const list = listRef.current?.getState();
    const rowsBelow = list && getRowsBelow(list.data.length, list.end);
    if (
      !shouldRequestNextPage({
        requestedSinceScroll: requestedSinceScroll.current,
        rowsBelow,
        rowsFitOnScreen: list?.start === 0 && rowsBelow === 0,
        rowsPending,
        status: pageStatus,
        thresholdRows: getThresholdRows(list?.scrollLength ?? 0, rowExtent),
      })
    ) {
      return;
    }
    requestedSinceScroll.current = true;
    onLoadMore();
  }
  return {
    listRef,
    request,
    resetOnDrag: () => {
      requestedSinceScroll.current = false;
    },
  };
}
