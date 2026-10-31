import type { MailThread } from "@rodge-mail/features/mail";

function createStableRows<Row extends { id: string }>() {
  const rows = new Map<string, { json: string; row: Row }>();
  return (next: Row[]) =>
    next.map((row) => {
      const json = JSON.stringify(row);
      const cached = rows.get(row.id);
      if (cached?.json === json) return cached.row;
      rows.set(row.id, { json, row });
      return row;
    });
}

/**
 * Gives back the same object for a row whose content hasn't changed, so a
 * new Convex page (after any mutation) re-renders only the rows that
 * changed instead of every native row on screen.
 */
export const stableRows = createStableRows<MailThread>();
