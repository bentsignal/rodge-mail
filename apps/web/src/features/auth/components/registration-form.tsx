import { useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { Loader } from "lucide-react";

import { useAuthStore } from "../store";

type RegistrationStep = "code" | "details";

export function RegistrationForm({ onCancel }: { onCancel: () => void }) {
  const [step, setStep] = useState<RegistrationStep>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  if (step === "code") {
    return (
      <RegistrationCodeStep
        email={email}
        name={name}
        onBack={() => setStep("details")}
      />
    );
  }

  return (
    <RegistrationDetailsStep
      email={email}
      name={name}
      onCancel={onCancel}
      onEmailChange={setEmail}
      onNameChange={setName}
      onSuccess={() => setStep("code")}
    />
  );
}

function RegistrationDetailsStep({
  email,
  name,
  onCancel,
  onEmailChange,
  onNameChange,
  onSuccess,
}: {
  email: string;
  name: string;
  onCancel: () => void;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onSuccess: () => void;
}) {
  const requestCode = useAuthStore((store) => store.requestRegistrationCode);
  const isLoading = useAuthStore((store) => store.isLoading);

  async function handleSubmit() {
    const wasSent = await requestCode({ email });
    if (wasSent) onSuccess();
  }

  return (
    <div>
      <StepHeading step="1 of 2" title="Create account" />
      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <RegistrationField
          autoComplete="name"
          label="Name"
          onChange={onNameChange}
          value={name}
        />
        <RegistrationField
          autoComplete="email"
          label="Email"
          onChange={onEmailChange}
          type="email"
          value={email}
        />
        <PrimaryButton
          disabled={isLoading || !name.trim() || !email.trim()}
          isLoading={isLoading}
          label="Continue"
        />
      </form>
      <BackButton label="Back to sign in" onClick={onCancel} />
    </div>
  );
}

function RegistrationCodeStep({
  email,
  name,
  onBack,
}: {
  email: string;
  name: string;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  const finishRegistration = useAuthStore((store) => store.finishRegistration);
  const isLoading = useAuthStore((store) => store.isLoading);
  const redirectUri = useSearch({
    from: "/login",
    select: (search) => search.redirect_uri,
  });

  return (
    <div>
      <StepHeading step="2 of 2" title="Check your email" />
      <p className="mt-2 text-sm leading-6 text-[#81776c] dark:text-[#aaa095]">
        Enter the code sent to {email}. Your device will then ask you to finish
        setting up your sign-in.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void finishRegistration({ code, email, name, redirectUri });
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
          disabled={isLoading || !code.trim()}
          isLoading={isLoading}
          label="Verify and continue"
        />
      </form>
      <BackButton label="Use a different email" onClick={onBack} />
    </div>
  );
}

function StepHeading({ step, title }: { step: string; title: string }) {
  return (
    <div>
      <p className="font-mono text-[8px] tracking-[0.16em] text-[#897d6f] uppercase">
        {step}
      </p>
      <h2 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.03em]">
        {title}
      </h2>
    </div>
  );
}

function RegistrationField({
  autoComplete,
  inputMode,
  label,
  onChange,
  type = "text",
  value,
}: {
  autoComplete: string;
  inputMode?: "numeric";
  label: string;
  onChange: (value: string) => void;
  type?: "email" | "text";
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[#6f675e] dark:text-[#bbb1a5]">
        {label}
      </span>
      <input
        autoComplete={autoComplete}
        className="border-border bg-background/65 h-11 w-full rounded-xl border px-3.5 text-sm transition outline-none focus:border-[#ba6b4f]/60 focus:ring-3 focus:ring-[#ba6b4f]/10"
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        required
        spellCheck={false}
        type={type}
        value={value}
      />
    </label>
  );
}

function PrimaryButton({
  disabled,
  isLoading,
  label,
}: {
  disabled: boolean;
  isLoading: boolean;
  label: string;
}) {
  return (
    <button
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#20251f] px-5 text-sm font-semibold text-[#f8f1e6] transition hover:bg-[#30362f] disabled:cursor-not-allowed disabled:opacity-55"
      disabled={disabled}
      type="submit"
    >
      <LoadingIndicator isLoading={isLoading} />
      {label}
    </button>
  );
}

function LoadingIndicator({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null;
  return <Loader className="size-4 animate-spin" />;
}

function BackButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="mt-5 w-full text-center text-xs font-medium text-[#81776c] transition hover:text-[#343832] dark:text-[#aaa095] dark:hover:text-white"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
