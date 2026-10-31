import { authClient } from "./client";

export async function authorizeCliAuth(requestId: string) {
  const result = await authClient.$fetch<{ authorizationCode: string }>(
    "/desktop-auth/authorize",
    { body: { requestId }, method: "POST" },
  );
  if (result.error) {
    throw new Error(result.error.message ?? "CLI sign-in expired");
  }
  return result.data.authorizationCode;
}
