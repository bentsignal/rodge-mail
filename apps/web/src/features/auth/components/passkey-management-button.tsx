import { useState } from "react";
import { Fingerprint, Loader, Settings } from "lucide-react";

import * as Dialog from "@rodge-mail/ui-web/dialog";

import { AppearanceSettings } from "~/features/theme/components/theme-toggle";
import { useAuthStore } from "../store";
import { AgentAccessSettings } from "./agent-access-settings";
import { SignOutLink } from "./sign-out-link";

export function PasskeyManagementButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [settingsSession, setSettingsSession] = useState(0);
  const addPasskey = useAuthStore((store) => store.addAuthenticatedPasskey);
  const isLoading = useAuthStore((store) => store.isLoading);

  async function registerPasskey() {
    const wasAdded = await addPasskey();
    if (!wasAdded) return;
    setIsOpen(false);
  }

  function changeOpen(nextOpen: boolean) {
    setIsOpen(nextOpen);
    if (!nextOpen) setSettingsSession((session) => session + 1);
  }

  return (
    <Dialog.Container onOpenChange={changeOpen} open={isOpen}>
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
      <Dialog.Content className="border-border bg-card max-h-[calc(100vh-2rem)] max-w-2xl gap-0 overflow-y-auto rounded-[22px] p-0">
        <div className="border-border border-b p-6">
          <Dialog.Title className="font-serif text-2xl tracking-[-0.03em]">
            Settings
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-xs leading-5 text-[#81766a] dark:text-[#aaa095]">
            Appearance and account controls for Rodge Mail.
          </Dialog.Description>
        </div>
        <div className="p-6">
          <AppearanceSettings />
        </div>
        <div className="border-border border-t p-6">
          <AgentAccessSettings key={settingsSession} />
        </div>
        <div className="border-border border-t p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#e7ded0] text-[#5d574f] dark:bg-[#353a34] dark:text-[#e5ddd1]">
              <Fingerprint className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Passkeys</p>
              <p className="mt-0.5 text-xs leading-5 text-[#81766a] dark:text-[#aaa095]">
                Add one for another device or password manager.
              </p>
            </div>
            <button
              className="border-border bg-background/60 hover:bg-background flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
              onClick={() => void registerPasskey()}
              type="button"
            >
              <RegisterIcon isLoading={isLoading} />
              Add
            </button>
          </div>
          <div className="border-border mt-5 border-t pt-5">
            <SignOutLink variant="settings" />
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Container>
  );
}

function RegisterIcon({ isLoading }: { isLoading: boolean }) {
  if (isLoading) return <Loader className="size-4 animate-spin" />;
  return <Fingerprint className="size-4" />;
}
