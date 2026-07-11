import { useState } from "react";

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
      <StepHeading step="Account recovery" title="Restore your sign-in" />
      <p className="mail-label mt-2 text-sm leading-6">
        We’ll email a short code before this device creates a new passkey.
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
          label="Send recovery code"
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

  async function handleSubmit() {
    const wasRecovered = await finishRecovery({ code, email });
    if (wasRecovered) onComplete();
  }

  return (
    <div>
      <StepHeading step="Account recovery" title="Check your email" />
      <p className="mail-label mt-2 text-sm leading-6">
        Enter the six-digit code sent to {email}. Your device will then save a
        new passkey.
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
          label="Create a new passkey"
        />
      </form>
      <BackButton label="Use a different email" onClick={onBack} />
    </div>
  );
}
