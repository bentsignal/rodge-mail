import { useState } from "react";
import { useSearch } from "@tanstack/react-router";

import { useAuthStore } from "../store";
import {
  BackButton,
  PrimaryButton,
  RegistrationField,
  StepHeading,
} from "./registration-form";

type RecoveryStep = "code" | "email";

export function RecoveryForm({ onCancel }: { onCancel: () => void }) {
  const [step, setStep] = useState<RecoveryStep>("email");
  const [email, setEmail] = useState("");

  if (step === "code") {
    return (
      <RecoveryCodeStep
        email={email}
        onBack={() => setStep("email")}
        onComplete={onCancel}
      />
    );
  }
  return (
    <RecoveryEmailStep
      email={email}
      onCancel={onCancel}
      onEmailChange={setEmail}
      onSuccess={() => setStep("code")}
    />
  );
}

function RecoveryEmailStep({
  email,
  onCancel,
  onEmailChange,
  onSuccess,
}: {
  email: string;
  onCancel: () => void;
  onEmailChange: (value: string) => void;
  onSuccess: () => void;
}) {
  const requestRecoveryCode = useAuthStore(
    (store) => store.requestRecoveryCode,
  );
  const isLoading = useAuthStore((store) => store.isLoading);

  async function handleSubmit() {
    const wasSent = await requestRecoveryCode({ email });
    if (wasSent) onSuccess();
  }

  return (
    <div>
      <StepHeading step="Email sign-in" title="Sign in with email" />
      <p className="mail-label mt-2 text-sm leading-6">
        We’ll email a short code so you can sign in on this device.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <RegistrationField
          autoComplete="email"
          label="Email"
          onChange={onEmailChange}
          type="email"
          value={email}
        />
        <PrimaryButton
          disabled={isLoading || !email.trim()}
          isLoading={isLoading}
          label="Send sign-in code"
        />
      </form>
      <BackButton label="Back to sign in" onClick={onCancel} />
    </div>
  );
}

function RecoveryCodeStep({
  email,
  onBack,
  onComplete,
}: {
  email: string;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [code, setCode] = useState("");
  const finishRecovery = useAuthStore((store) => store.finishRecovery);
  const isLoading = useAuthStore((store) => store.isLoading);
  const redirectUri = useSearch({
    from: "/login",
    select: (search) => search.redirect_uri,
  });

  async function handleSubmit() {
    const wasRecovered = await finishRecovery({ code, email, redirectUri });
    if (wasRecovered) onComplete();
  }

  return (
    <div>
      <StepHeading step="Email sign-in" title="Check your email" />
      <p className="mail-label mt-2 text-sm leading-6">
        Enter the six-digit code sent to {email}.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <RegistrationField
          autoComplete="one-time-code"
          inputMode="numeric"
          label="Code"
          onChange={setCode}
          value={code}
        />
        <PrimaryButton
          disabled={isLoading || code.trim().length !== 6}
          isLoading={isLoading}
          label="Verify and continue"
        />
      </form>
      <BackButton label="Use a different email" onClick={onBack} />
    </div>
  );
}
