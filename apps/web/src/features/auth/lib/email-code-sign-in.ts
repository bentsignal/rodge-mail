import { getSafeAppRedirect } from "./safe-redirect";

interface EmailCodeSignInResult {
  data: { success: boolean } | null;
  error: { message?: string } | null;
}

export async function completeEmailCodeSignIn(
  verify: () => Promise<EmailCodeSignInResult>,
  redirectUri: string | undefined,
) {
  const result = await verify();
  if (result.error || !result.data?.success) {
    throw new Error(
      result.error?.message ?? "The sign-in code is invalid or expired",
    );
  }
  return getSafeAppRedirect(redirectUri);
}
