/* eslint-disable @typescript-eslint/consistent-type-assertions -- Expo route params and shared view models preserve Convex IDs as runtime strings. */
import type { Id, TableNames } from "@rodge-mail/convex/model";

export function toConvexId<TableName extends TableNames>(value: string) {
  return value as Id<TableName>;
}
