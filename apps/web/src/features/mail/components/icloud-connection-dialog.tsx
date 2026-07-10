import { useState } from "react";
import { useAction } from "convex/react";
import { Cloud, Loader } from "lucide-react";

import { api } from "@rodge-mail/convex/api";
import * as Dialog from "@rodge-mail/ui-web/dialog";
import { toast } from "@rodge-mail/ui-web/toast";

export function ICloudConnectionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const connect = useAction(api.providers.icloud.actions.connect);
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  async function connectAccount() {
    setIsConnecting(true);
    try {
      await connect({ address, password });
      setPassword("");
      toast.success("iCloud Mail connected. Initial sync is running.");
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
    setIsConnecting(false);
  }

  return (
    <Dialog.Container onOpenChange={onOpenChange} open={open}>
      <Dialog.Content className="max-w-md rounded-[22px] border-[#cfc4b5] bg-[#fbf8f1] p-0 dark:border-[#4a4f48] dark:bg-[#252924]">
        <div className="border-b border-[#ded5c8] p-6 dark:border-[#41453f]">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#e7ded0] text-[#5d574f] dark:bg-[#353a34] dark:text-[#e5ddd1]">
            <Cloud className="size-4" />
          </span>
          <Dialog.Title className="mt-4 font-serif text-2xl tracking-[-0.03em]">
            Connect iCloud Mail
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-xs leading-5 text-[#81766a] dark:text-[#aaa095]">
            Use an Apple app-specific password. Rodge Mail verifies it directly
            with Apple, encrypts it in Convex, and never stores your primary
            Apple Account password.
          </Dialog.Description>
        </div>
        <form
          className="space-y-4 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void connectAccount();
          }}
        >
          <ConnectionField
            autoComplete="email"
            label="iCloud Mail address"
            onChange={setAddress}
            placeholder="you@icloud.com"
            type="email"
            value={address}
          />
          <ConnectionField
            autoComplete="off"
            label="App-specific password"
            onChange={setPassword}
            placeholder="xxxx-xxxx-xxxx-xxxx"
            type="password"
            value={password}
          />
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#20251f] px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#30362f] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isConnecting || !address.trim() || !password.trim()}
            type="submit"
          >
            <ConnectButtonContent isConnecting={isConnecting} />
          </button>
          <p className="text-[10px] leading-4 text-[#8d8276]">
            Create the password at account.apple.com. Changing your primary
            Apple Account password revokes existing app-specific passwords.
          </p>
        </form>
      </Dialog.Content>
    </Dialog.Container>
  );
}

function ConnectButtonContent({ isConnecting }: { isConnecting: boolean }) {
  if (!isConnecting) return <>Connect iCloud Mail</>;
  return (
    <>
      <Loader className="size-4 animate-spin" />
      Verifying with Apple…
    </>
  );
}

function ConnectionField({
  autoComplete,
  label,
  onChange,
  placeholder,
  type,
  value,
}: {
  autoComplete: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type: "email" | "password";
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[8px] tracking-[0.16em] text-[#81766a] uppercase">
        {label}
      </span>
      <input
        autoComplete={autoComplete}
        className="border-border bg-background/65 h-11 w-full rounded-xl border px-3.5 text-sm outline-none focus:border-[#ba6b4f]/60 focus:ring-3 focus:ring-[#ba6b4f]/10"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        type={type}
        value={value}
      />
    </label>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Rodge Mail could not verify this iCloud account.";
}
