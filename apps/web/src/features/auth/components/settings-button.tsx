import { Settings } from "lucide-react";

import * as Dialog from "@rodge-mail/ui-web/dialog";

import { AppearanceSettings } from "~/features/theme/components/theme-toggle";
import { authClient } from "../lib/client";
import { RodgeAccountSettings } from "./rodge-account-settings";

export function SettingsButton() {
  return (
    <Dialog.Container
      onOpenChange={(open) => {
        if (open) authClient.$store.notify("$listPasskeys");
      }}
    >
      <Dialog.Trigger asChild>
        <button
          aria-label="Settings"
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-transparent px-2 transition-colors"
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
            Appearance and your Rodge Mail account.
          </Dialog.Description>
        </div>
        <div className="bg-background p-6">
          <AppearanceSettings />
        </div>
        <div className="bg-background border-border border-t p-6">
          <RodgeAccountSettings />
        </div>
      </Dialog.Content>
    </Dialog.Container>
  );
}
