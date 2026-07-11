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
          className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-transparent px-3 text-[var(--mail-chassis-foreground)]/72 transition-colors hover:border-white/10 hover:bg-white/[0.07] hover:text-[var(--mail-chassis-foreground)] xl:justify-start"
          type="button"
        >
          <Settings className="size-4" />
          <span className="hidden text-xs xl:inline">Account settings</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Content className="mail-dialog mail-workspace max-h-[calc(100vh-2rem)] max-w-2xl gap-0 overflow-hidden overflow-y-auto rounded-[18px] border p-0">
        <div className="mail-chassis border-b p-6">
          <Dialog.Title className="font-serif text-2xl tracking-[-0.03em]">
            Settings
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-xs leading-5 text-[var(--mail-chassis-foreground)]/70">
            Appearance and account controls for Rodge Mail.
          </Dialog.Description>
        </div>
        <div className="mail-paper p-6">
          <AppearanceSettings />
        </div>
        <div className="mail-paper border-t border-[var(--mail-seam)] p-6">
          <AgentAccessSettings key={settingsSession} />
        </div>
        <div className="mail-paper border-t border-[var(--mail-seam)] p-6">
          <div className="flex items-center gap-3">
            <span className="mail-raised flex size-9 shrink-0 items-center justify-center rounded-[9px] border text-[var(--mail-ink-soft)]">
              <Fingerprint className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Passkeys</p>
              <p className="mail-label mt-0.5 text-xs leading-5">
                Add one for another device or password manager.
              </p>
            </div>
            <button
              className="mail-raised flex h-9 shrink-0 items-center justify-center gap-2 rounded-[9px] border px-3 text-xs font-semibold transition-colors hover:border-[var(--mail-brass)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isLoading}
              onClick={() => void registerPasskey()}
              type="button"
            >
              <RegisterIcon isLoading={isLoading} />
              Add
            </button>
          </div>
          <div className="mt-5 border-t border-[var(--mail-seam)] pt-5">
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
