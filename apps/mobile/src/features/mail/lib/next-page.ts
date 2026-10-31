/** A Convex `usePaginatedQuery` status. */
export type PageStatus =
  | "CanLoadMore"
  | "Exhausted"
  | "LoadingFirstPage"
  | "LoadingMore";

/**
 * How far from the end, in screens, a list asks for its next page, so the
 * page is usually in before the user gets there. The web app uses the same.
 */
export const NEXT_PAGE_THRESHOLD = 1.5;

/**
 * Whether the list should ask for its next page. Only when the query has a
 * cursor to continue from and nothing in flight, every loaded row is shown,
 * no more than `thresholdRows` rows are left below the last one on screen,
 * and the user has scrolled since the last request (unless every row fits
 * on screen, where there's nothing to scroll).
 *
 * Each condition stops a way the list used to chain requests: LegendList
 * sizes appended rows lazily, so its end signal fires again for every data
 * change; a list held still mid-fling sees no new rows; and search results
 * re-sort by date, so a new page lands above the viewport and leaves the
 * user at the end. Counting rows, and waiting for the user, keeps it to one
 * request each time they reach the end.
 */
export function shouldRequestNextPage({
  requestedSinceScroll,
  rowsBelow,
  rowsFitOnScreen,
  rowsPending,
  status,
  thresholdRows,
}: {
  requestedSinceScroll: boolean;
  rowsBelow: number | undefined;
  rowsFitOnScreen: boolean;
  rowsPending: boolean;
  status: PageStatus;
  thresholdRows: number;
}) {
  if (status !== "CanLoadMore" || rowsPending) return false;
  if (rowsBelow !== undefined && rowsBelow > thresholdRows) return false;
  return !requestedSinceScroll || rowsFitOnScreen;
}

/** How many rows fill `NEXT_PAGE_THRESHOLD` screens of `viewportLength`. */
export function getThresholdRows(viewportLength: number, rowLength: number) {
  return Math.ceil((NEXT_PAGE_THRESHOLD * viewportLength) / rowLength);
}

/** Rows after the last one on screen, if the list has measured that yet. */
export function getRowsBelow(rowCount: number, lastVisibleIndex: number) {
  if (lastVisibleIndex < 0) return undefined;
  return Math.max(rowCount - 1 - lastVisibleIndex, 0);
}

/**
 * What the list's footer shows: a spinner while a page loads, the same
 * space while another page may follow (so the spinner appearing doesn't
 * resize the content), and nothing once the list is complete.
 */
export function getPageFooter({
  isLoading,
  status,
}: {
  isLoading: boolean;
  status: PageStatus;
}) {
  if (isLoading || status === "LoadingMore") return "loading";
  if (status === "CanLoadMore") return "reserved";
  return "none";
}

/**
 * The rows to show while a list holds still under the finger: the held
 * rows, plus any rows appended after them, since rows added below don't
 * move anything on screen. `hasAllRows` says whether that's everything in
 * `next`; any other change waits until the list comes to rest.
 */
export function appendToHeldRows<Row>(
  held: readonly Row[],
  next: readonly Row[],
  keyOf: (row: Row) => string,
) {
  const isPrefix =
    next.length >= held.length &&
    held.every((row, index) => {
      const nextRow = next[index];
      return nextRow !== undefined && keyOf(nextRow) === keyOf(row);
    });
  if (!isPrefix) return { hasAllRows: false, rows: held };
  if (next.length === held.length) return { hasAllRows: true, rows: held };
  return { hasAllRows: true, rows: [...held, ...next.slice(held.length)] };
}
