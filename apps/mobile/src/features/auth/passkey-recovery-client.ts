interface RecoveryVerificationResult {
  data?: { success: boolean } | null;
  error?: { message?: string } | null;
}

interface CompleteRecoverySignInOptions {
  code: string;
  email: string;
  verify: (input: {
    code: string;
    email: string;
  }) => Promise<RecoveryVerificationResult>;
}

export async function completeRecoverySignIn({
  code,
  email,
  verify,
}: CompleteRecoverySignInOptions) {
  const verification = await verify({ code, email });
  if (verification.error) {
    return {
      message:
        verification.error.message ?? "The sign-in code is invalid or expired",
      success: false,
    };
  }
  if (!verification.data?.success) {
    return {
      message: "The sign-in code is invalid or expired",
      success: false,
    };
  }
  return { success: true };
}
