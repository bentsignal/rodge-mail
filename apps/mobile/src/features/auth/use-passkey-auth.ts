import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

import { authClient } from "./client";

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
      const result = await authClient.signIn.passkey();
      setOperation(undefined);
      if (result.error) {
        setMessage(result.error.message ?? "Passkey sign-in failed");
      }
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
    recoverPasskey: recovery.recoverPasskey,
    requestCode: registration.requestCode,
    requestRecoveryCode: recovery.requestRecoveryCode,
    setCode,
    setEmail,
    setName,
    show,
    signIn,
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
      const passkey = await authClient.passkey.addPasskey({
        authenticatorAttachment: "platform",
      });
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
          result.error.message ?? "Could not send a recovery code",
        );
        return;
      }
      state.setView("recover-code");
    } catch (error) {
      finishActionWithError(state, error);
    }
  }

  async function recoverPasskey() {
    const otp = state.code.trim();
    if (otp.length !== 6) return;
    state.setOperation("verify");
    state.setMessage(undefined);
    try {
      const verification = await authClient.$fetch<{
        recoveryToken: string;
      }>("/passkey-recovery/verify", {
        body: { code: otp, email: state.email },
        method: "POST",
      });
      if (verification.error) {
        state.setOperation(undefined);
        state.setMessage(
          verification.error.message ??
            "The recovery code is invalid or expired",
        );
        return;
      }
      const passkey = await authClient.passkey.addPasskey({
        authenticatorAttachment: "platform",
        context: verification.data.recoveryToken,
      });
      state.setOperation(undefined);
      if (passkey.error) {
        state.setMessage(passkey.error.message ?? "Could not create a passkey");
        return;
      }
      state.setCode("");
      state.setView("sign-in");
      state.setMessage("Passkey restored. Sign in to continue.");
    } catch (error) {
      finishActionWithError(state, error);
    }
  }

  return { recoverPasskey, requestRecoveryCode };
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
