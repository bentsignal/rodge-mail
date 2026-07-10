import { useState } from "react";
import { Check, KeyRound, Loader, ShieldCheck } from "lucide-react";

import { useAuthStore } from "../store";
import { SignInButton } from "./sign-in-button";

export function OwnerSetupForm() {
  const [name, setName] = useState("Primary passkey");
  const [token, setToken] = useState("");
  const [setupIsComplete, setSetupIsComplete] = useState(false);
  const bootstrapOwnerPasskey = useAuthStore(
    (store) => store.bootstrapOwnerPasskey,
  );
  const isLoading = useAuthStore((store) => store.isLoading);

  if (setupIsComplete) return <SetupComplete />;

  async function handleSubmit() {
    const wasCreated = await bootstrapOwnerPasskey({ name, token });
    setToken("");
    if (wasCreated) setSetupIsComplete(true);
  }

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <SetupField
        label="Passkey name"
        onChange={setName}
        placeholder="Primary passkey"
        value={name}
      />
      <SetupField
        autoComplete="off"
        label="One-time setup token"
        onChange={setToken}
        placeholder="OWNER_BOOTSTRAP_TOKEN"
        type="password"
        value={token}
      />
      <button
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#cfc4b5] bg-white/40 text-sm font-semibold text-[#343832] transition hover:border-[#a99a88] hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#4a4f48] dark:bg-white/[0.025] dark:text-[#eee6da]"
        disabled={isLoading || !name.trim() || !token}
        type="submit"
      >
        <SetupButtonIcon isLoading={isLoading} />
        Create owner passkey
      </button>
      <p className="flex gap-2.5 text-[11px] leading-5 text-[#84796d] dark:text-[#aca297]">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#397367]" />
        The token stays only in this form and is cleared after this attempt.
        Remove it from the Convex deployment after two passkeys are registered;
        that permanently closes initial setup.
      </p>
    </form>
  );
}

function SetupField({
  autoComplete,
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  autoComplete?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "password" | "text";
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[8px] tracking-[0.16em] text-[#81766a] uppercase">
        {label}
      </span>
      <input
        autoComplete={autoComplete}
        className="border-border bg-background/65 h-11 w-full rounded-xl border px-3.5 text-sm transition outline-none placeholder:text-[#a79d91] focus:border-[#ba6b4f]/60 focus:ring-3 focus:ring-[#ba6b4f]/10"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        type={type}
        value={value}
      />
    </label>
  );
}

function SetupButtonIcon({ isLoading }: { isLoading: boolean }) {
  if (isLoading) return <Loader className="size-4 animate-spin" />;
  return <KeyRound className="size-4" />;
}

function SetupComplete() {
  return (
    <div className="mt-5 rounded-2xl border border-[#9db9a9] bg-[#edf4ee] p-4 dark:border-[#456356] dark:bg-[#29342d]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#397367] text-white">
          <Check className="size-3.5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[#274a3f] dark:text-[#d5e8dd]">
            Passkey created
          </p>
          <p className="mt-1 text-xs leading-5 text-[#557064] dark:text-[#aabfb3]">
            The credential is ready. Sign in once to open Rodge Mail and add a
            second passkey from the account rail.
          </p>
        </div>
      </div>
      <div className="mt-4">
        <SignInButton compact />
      </div>
    </div>
  );
}
