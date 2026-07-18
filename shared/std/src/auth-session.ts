interface AuthOperationResult {
  error?: { message?: string | null } | null;
}

interface SessionResult {
  data?: { session?: unknown } | null;
}

interface CompleteAuthSessionOptions {
  authenticate: () => Promise<AuthOperationResult>;
  confirmSession: () => Promise<SessionResult>;
  fallbackMessage: string;
  refreshSession: () => void;
}

export async function completeAuthSession({
  authenticate,
  confirmSession,
  fallbackMessage,
  refreshSession,
}: CompleteAuthSessionOptions) {
  let failure: unknown;
  try {
    const result = await authenticate();
    if (!result.error) {
      refreshSession();
      return;
    }
    failure = new Error(
      getAuthErrorMessage(result.error.message, fallbackMessage),
    );
  } catch (error) {
    failure = error;
  }

  if (await hasAuthenticatedSession(confirmSession)) {
    refreshSession();
    return;
  }
  throw failure;
}

function getAuthErrorMessage(
  message: string | null | undefined,
  fallbackMessage: string,
) {
  const trimmed = message?.trim();
  if (trimmed === undefined || trimmed.length === 0) return fallbackMessage;
  return trimmed;
}

async function hasAuthenticatedSession(
  confirmSession: () => Promise<SessionResult>,
) {
  try {
    const result = await confirmSession();
    return !!result.data?.session;
  } catch {
    return false;
  }
}
