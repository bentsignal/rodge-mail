import { useState } from "react";
import { Fingerprint, Loader, Settings } from "lucide-react";

import * as Dialog from "@rodge-mail/ui-web/dialog";

import { AppearanceSettings } from "~/features/theme/components/theme-toggle";
import { useAuthStore } from "../store";
import { SignOutLink } from "./sign-out-link";

export function PasskeyManagementButton({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const addPasskey = useAuthStore((store) => store.addAuthenticatedPasskey);
  const isLoading = useAuthStore((store) => store.isLoading);

  async function registerPasskey() {
    const wasAdded = await addPasskey();
    if (!wasAdded) return;
    setIsOpen(false);
  }

  function changeOpen(nextOpen: boolean) {
    setIsOpen(nextOpen);
  }

  return (
    <Dialog.Container onOpenChange={changeOpen} open={isOpen}>
      <Dialog.Trigger asChild>
        <button
          aria-label="Settings"
          className={
            compact
              ? "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-transparent px-2 transition-colors"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-transparent px-3 transition-colors xl:justify-start"
          }
          type="button"
        >
          <Settings className="size-4" />
          <span className="hidden text-xs xl:inline">Settings</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Content className="mail-dialog bg-background max-h-[calc(100vh-2rem)] max-w-2xl gap-0 overflow-hidden overflow-y-auto rounded-[18px] border p-0">
        <div className="border-b p-6">
          <Dialog.Title className="text-2xl font-semibold tracking-tight">
            Settings
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground mt-2 text-xs leading-5">
            Appearance and security controls for Rodge Mail.
          </Dialog.Description>
        </div>
        <div className="bg-background p-6">
          <AppearanceSettings />
        </div>
        <div className="bg-background border-border border-t p-6">
          <div className="flex items-center gap-3">
            <span className="bg-background text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-[9px] border">
              <Fingerprint className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Passkeys</p>
              <p className="mail-label mt-0.5 text-xs leading-5">
                Add one for another device or password manager.
              </p>
            </div>
            <button
              className="bg-background hover:bg-accent flex h-9 shrink-0 items-center justify-center gap-2 rounded-[9px] border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
