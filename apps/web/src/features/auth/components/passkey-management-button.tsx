import { useState } from "react";
import { Fingerprint, Loader, Settings } from "lucide-react";

import * as Dialog from "@rodge-mail/ui-web/dialog";

import { useAuthStore } from "../store";

export function PasskeyManagementButton() {
  const [isOpen, setIsOpen] = useState(false);
  const addPasskey = useAuthStore((store) => store.addAuthenticatedPasskey);
  const isLoading = useAuthStore((store) => store.isLoading);

  async function registerPasskey() {
    const wasAdded = await addPasskey();
    if (!wasAdded) return;
    setIsOpen(false);
  }

  return (
    <Dialog.Container onOpenChange={setIsOpen} open={isOpen}>
      <Dialog.Trigger asChild>
        <button
          aria-label="Account settings"
          className="flex h-10 w-full items-center justify-center gap-2.5 rounded-xl px-3 text-[#756c63] transition-colors hover:bg-black/[0.04] hover:text-[#20251f] xl:justify-start dark:text-[#aaa195] dark:hover:bg-white/[0.05] dark:hover:text-white"
          type="button"
        >
          <Settings className="size-4" />
          <span className="hidden text-xs xl:inline">Account settings</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Content className="max-w-md rounded-[22px] border-[#cfc4b5] bg-[#fbf8f1] p-0 dark:border-[#4a4f48] dark:bg-[#252924]">
        <div className="border-b border-[#ded5c8] p-6 dark:border-[#41453f]">
          <Dialog.Title className="font-serif text-2xl tracking-[-0.03em]">
            Account settings
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-xs leading-5 text-[#81766a] dark:text-[#aaa095]">
            Manage sign-in security for this Rodge Mail profile.
          </Dialog.Description>
        </div>
        <div className="p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#e7ded0] text-[#5d574f] dark:bg-[#353a34] dark:text-[#e5ddd1]">
              <Fingerprint className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">Passkeys</p>
              <p className="mt-1 text-xs leading-5 text-[#81766a] dark:text-[#aaa095]">
                Register this device, a password manager, or a security key.
              </p>
            </div>
          </div>
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#20251f] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#30362f] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={() => void registerPasskey()}
            type="button"
          >
            <RegisterIcon isLoading={isLoading} />
            Add passkey
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Container>
  );
}

function RegisterIcon({ isLoading }: { isLoading: boolean }) {
  if (isLoading) return <Loader className="size-4 animate-spin" />;
  return <Fingerprint className="size-4" />;
}
