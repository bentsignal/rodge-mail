interface PasskeyOperationResult {
  error?: { message?: string | null } | null;
}

const associationFailure = "unable to verify webcredentials association";
const authorizationCanceled =
  /AuthenticationServices\.AuthorizationError(?:,| error)\s*1001/i;

export const incompatiblePasskeyMessage =
  "No compatible passkey was selected. Choose a Rodge Mail passkey saved on this device.";

export async function retryTransientPasskeyAssociation<
  Result extends PasskeyOperationResult,
>(
  operation: () => Promise<Result>,
  wait: () => Promise<void> = waitForAssociationCache,
) {
  try {
    const result = await operation();
    if (!isTransientAssociationFailure(result.error)) return result;
  } catch (error) {
    if (!isTransientAssociationFailure(error)) throw error;
  }

  await wait();
  return await operation();
}

export function getPasskeySignInErrorMessage(error: unknown) {
  const message = getErrorMessage(error);
  if (message && authorizationCanceled.test(message)) {
    return incompatiblePasskeyMessage;
  }
  return message ?? "Authentication did not complete.";
}

function isTransientAssociationFailure(error: unknown) {
  return getErrorMessage(error)?.toLowerCase().includes(associationFailure);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return undefined;
  }
  return typeof error.message === "string" ? error.message : undefined;
}

async function waitForAssociationCache() {
  await new Promise((resolve) => setTimeout(resolve, 500));
}
