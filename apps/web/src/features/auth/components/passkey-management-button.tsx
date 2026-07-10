import { useState } from "react";
import { Fingerprint, KeyRound, Loader, Plus } from "lucide-react";

import * as Dialog from "@rodge-mail/ui-web/dialog";

import { useAuthStore } from "../store";

export function PasskeyManagementButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const addPasskey = useAuthStore((store) => store.addAuthenticatedPasskey);
  const isLoading = useAuthStore((store) => store.isLoading);

  async function registerPasskey() {
    const wasAdded = await addPasskey(name);
    if (!wasAdded) return;
    setName("");
    setIsOpen(false);
  }

  return (
    <Dialog.Container onOpenChange={setIsOpen} open={isOpen}>
      <Dialog.Trigger asChild>
        <button
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl px-2 text-[#756c63] transition hover:bg-black/[0.04] hover:text-[#20251f] xl:justify-start dark:text-[#aaa195] dark:hover:bg-white/[0.05] dark:hover:text-white"
          type="button"
        >
          <Fingerprint className="size-4" />
          <span className="hidden text-xs xl:inline">Add passkey</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Content className="max-w-md rounded-[22px] border-[#cfc4b5] bg-[#fbf8f1] p-0 dark:border-[#4a4f48] dark:bg-[#252924]">
        <div className="border-b border-[#ded5c8] p-6 dark:border-[#41453f]">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#e7ded0] text-[#5d574f] dark:bg-[#353a34] dark:text-[#e5ddd1]">
            <KeyRound className="size-4" />
          </span>
          <Dialog.Title className="mt-4 font-serif text-2xl tracking-[-0.03em]">
            Add another passkey
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-xs leading-5 text-[#81766a] dark:text-[#aaa095]">
            Register this device, a password manager, or a security key while
            your owner session is active. The bootstrap token is not needed.
          </Dialog.Description>
        </div>
        <form
          className="p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void registerPasskey();
          }}
        >
          <label className="block">
            <span className="mb-1.5 block font-mono text-[8px] tracking-[0.16em] text-[#81766a] uppercase">
              Passkey name
            </span>
            <input
              autoFocus
              className="border-border bg-background/65 h-11 w-full rounded-xl border px-3.5 text-sm transition outline-none placeholder:text-[#a79d91] focus:border-[#ba6b4f]/60 focus:ring-3 focus:ring-[#ba6b4f]/10"
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. MacBook Touch ID"
              value={name}
            />
          </label>
          <button
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#20251f] px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#30362f] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading || !name.trim()}
            type="submit"
          >
            <RegisterIcon isLoading={isLoading} />
            Register passkey
          </button>
          <p className="mt-3 flex items-start gap-2 text-[10px] leading-4 text-[#8d8276]">
            <Plus className="mt-0.5 size-3 shrink-0" />
            Keep at least two independent passkeys before removing the one-time
            setup token from the deployment.
          </p>
        </form>
      </Dialog.Content>
    </Dialog.Container>
  );
}

function RegisterIcon({ isLoading }: { isLoading: boolean }) {
  if (isLoading) return <Loader className="size-4 animate-spin" />;
  return <Fingerprint className="size-4" />;
}
