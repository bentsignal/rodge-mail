import type { BetterAuthOptions } from "better-auth/minimal";
import { APIError } from "better-auth/api";

export function isAllowedUser(userId: string, allowedUserId: string) {
  return Boolean(allowedUserId) && userId === allowedUserId;
}

export function privateAccountHooks(allowedUserId: string) {
  return {
    user: {
      create: {
        before: () => {
          throw new APIError("FORBIDDEN", {
            message: "Registration is closed",
          });
        },
      },
    },
    session: {
      create: {
        before: (session) => {
          if (!isAllowedUser(session.userId, allowedUserId)) {
            throw new APIError("FORBIDDEN", { message: "Access denied" });
          }
          return Promise.resolve({ data: session });
        },
      },
    },
  } satisfies BetterAuthOptions["databaseHooks"];
}
