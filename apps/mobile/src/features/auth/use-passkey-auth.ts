import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

import { completeAuthSession } from "@rodge-mail/std/auth-session";

import { authClient } from "./client";
import { retryTransientPasskeyAssociation } from "./native-passkey-operation";
import { completeRecoverySignIn } from "./passkey-recovery-client";

type AuthOperation = "request-code" | "sign-in" | "verify";
type AuthView = "details" | "recover" | "recover-code" | "sign-in" | "verify";

interface AuthActionState {
  code: string;
  email: string;
  name: string;
  setCode: Dispatch<SetStateAction<string>>;
  setEmail: Dispatch<SetStateAction<string>>;
  setMessage: Dispatch<SetStateAction<string | undefined>>;
  setOperation: Dispatch<SetStateAction<AuthOperation | undefined>>;
  setView: Dispatch<SetStateAction<AuthView>>;
}

export function usePasskeyAuth() {
  const [view, setView] = useState<AuthView>("sign-in");
  const [operation, setOperation] = useState<AuthOperation>();
  const [message, setMessage] = useState<string>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const actionState = {
    code,
    email,
    name,
    setCode,
    setEmail,
    setMessage,
    setOperation,
    setView,
  };
  const registration = createRegistrationActions(actionState);
  const recovery = createRecoveryActions(actionState);

  async function signIn() {
    setOperation("sign-in");
    setMessage(undefined);
    try {
      await completeAuthSession({
        authenticate: async () =>
          await retryTransientPasskeyAssociation(
            async () => await authClient.signIn.passkey(),
          ),
        confirmSession: async () => await authClient.getSession(),
        fallbackMessage: "Passkey sign-in failed",
        refreshSession: () => authClient.$store.notify("$sessionSignal"),
      });
      setOperation(undefined);
    } catch (error) {
      finishWithError(error);
    }
  }

  function finishWithError(error: unknown) {
    setOperation(undefined);
    setMessage(getErrorMessage(error));
  }

  function show(nextView: AuthView) {
    setView(nextView);
    setMessage(undefined);
  }

  return {
    code,
    email,
    message,
    name,
    operation,
    requestCode: registration.requestCode,
    requestRecoveryCode: recovery.requestRecoveryCode,
    setCode,
    setEmail,
    setName,
    show,
    signIn,
    signInWithRecoveryCode: recovery.signInWithRecoveryCode,
    verifyAndCreatePasskey: registration.verifyAndCreatePasskey,
    view,
  };
}

function createRegistrationActions(state: AuthActionState) {
  async function requestCode() {
    const normalizedEmail = state.email.trim().toLowerCase();
    if (!state.name.trim() || !normalizedEmail) return;
    state.setEmail(normalizedEmail);
    state.setOperation("request-code");
    state.setMessage(undefined);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "sign-in",
      });
      state.setOperation(undefined);
      if (result.error) {
        state.setMessage(
          result.error.message ?? "Could not send a verification code",
        );
        return;
      }
      state.setView("verify");
    } catch (error) {
      finishActionWithError(state, error);
    }
  }

  async function verifyAndCreatePasskey() {
    const otp = state.code.trim();
    if (otp.length !== 6) return;
    let didVerify = false;
    state.setOperation("verify");
    state.setMessage(undefined);
    try {
      const verification = await authClient.signIn.emailOtp({
        email: state.email,
        name: state.name.trim(),
        otp,
      });
      if (verification.error) {
        state.setOperation(undefined);
        state.setMessage(verification.error.message ?? "Verification failed");
        return;
      }
      didVerify = true;
      const passkey = await retryTransientPasskeyAssociation(
        async () =>
          await authClient.passkey.addPasskey({
            authenticatorAttachment: "platform",
          }),
      );
      state.setOperation(undefined);
      if (passkey.error) {
        await signOutAfterFailedPasskey();
        state.setMessage(passkey.error.message ?? "Could not create a passkey");
      }
    } catch (error) {
      if (didVerify) await signOutAfterFailedPasskey();
      finishActionWithError(state, error);
    }
  }

  return { requestCode, verifyAndCreatePasskey };
}

function createRecoveryActions(state: AuthActionState) {
  async function requestRecoveryCode() {
    const normalizedEmail = state.email.trim().toLowerCase();
    if (!normalizedEmail) return;
    state.setEmail(normalizedEmail);
    state.setOperation("request-code");
    state.setMessage(undefined);
    try {
      const result = await authClient.$fetch<{ success: boolean }>(
        "/passkey-recovery/request",
        { body: { email: normalizedEmail }, method: "POST" },
      );
      state.setOperation(undefined);
      if (result.error) {
        state.setMessage(
          result.error.message ?? "Could not send a sign-in code",
        );
        return;
      }
      state.setView("recover-code");
    } catch (error) {
      finishActionWithError(state, error);
    }
  }

  async function signInWithRecoveryCode() {
    const otp = state.code.trim();
    if (otp.length !== 6) return;
    state.setOperation("verify");
    state.setMessage(undefined);
    try {
      const result = await completeRecoverySignIn({
        code: otp,
        email: state.email,
        verify: async ({ code, email }) =>
          await authClient.$fetch<{ success: boolean }>(
            "/passkey-recovery/verify",
            { body: { code, email }, method: "POST" },
          ),
      });
      state.setOperation(undefined);
      if (!result.success) {
        state.setMessage(result.message);
        return;
      }
      state.setCode("");
    } catch (error) {
      finishActionWithError(state, error);
    }
  }

  return { requestRecoveryCode, signInWithRecoveryCode };
}

function finishActionWithError(state: AuthActionState, error: unknown) {
  state.setOperation(undefined);
  state.setMessage(getErrorMessage(error));
}

async function signOutAfterFailedPasskey() {
  try {
    await authClient.signOut();
  } catch {
    return;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Authentication did not complete.";
}
