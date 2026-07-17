import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { useAction } from "convex/react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Cloud,
  Loader,
  Mail,
  Plus,
} from "lucide-react";

import { api } from "@rodge-mail/convex/api";
import * as Dialog from "@rodge-mail/ui-web/dialog";
import { toast } from "@rodge-mail/ui-web/toast";

import type { MailAccountView } from "../types";
import { ICloudConnectionDialog } from "./icloud-connection-dialog";

type ConnectableProvider = "gmail" | "icloud" | "microsoft";

const PROVIDERS = [
  {
    description: "Google accounts and Google Workspace",
    icon: Mail,
    label: "Gmail",
    provider: "gmail",
  },
  {
    description: "iCloud Mail with an app-specific password",
    icon: Cloud,
    label: "iCloud",
    provider: "icloud",
  },
  {
    description: "Outlook and Microsoft 365 accounts",
    icon: BriefcaseBusiness,
    label: "Microsoft 365",
    provider: "microsoft",
  },
] satisfies {
  description: string;
  icon: LucideIcon;
  label: string;
  provider: ConnectableProvider;
}[];

export function AddAccountButton({
  accounts,
  appearance = "rail",
}: {
  accounts: MailAccountView[];
  appearance?: "manager" | "rail";
}) {
  const connectGmail = useAction(api.accounts.actions.connectGmail);
  const connectMicrosoft = useAction(api.accounts.actions.connectMicrosoft);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [icloudOpen, setICloudOpen] = useState(false);
  const [connectingProvider, setConnectingProvider] =
    useState<ConnectableProvider>();

  async function connectOAuthProvider(
    provider: "gmail" | "microsoft",
    startAuthorization: () => Promise<{ authorizationUrl: string }>,
  ) {
    setConnectingProvider(provider);
    try {
      const result = await startAuthorization();
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      toast.error(getConnectionError(error, provider));
      setConnectingProvider(undefined);
    }
  }

  function chooseProvider(provider: ConnectableProvider) {
    if (provider === "icloud") {
      setChooserOpen(false);
      setICloudOpen(true);
      return;
    }
    if (provider === "gmail") {
      void connectOAuthProvider("gmail", () =>
        connectGmail({ returnPath: "/" }),
      );
      return;
    }
    void connectOAuthProvider("microsoft", () =>
      connectMicrosoft({ returnPath: "/" }),
    );
  }

  return (
    <>
      <Dialog.Container onOpenChange={setChooserOpen} open={chooserOpen}>
        <Dialog.Trigger asChild>
          <button
            aria-label="Add account"
            className={
              appearance === "manager"
                ? "mail-raised flex h-9 shrink-0 items-center justify-center gap-2 rounded-[9px] border px-3 text-xs font-semibold transition-colors hover:border-[var(--mail-brass)]"
                : "mt-3 flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-dashed border-white/25 px-3 text-xs font-semibold text-[var(--mail-chassis-foreground)]/72 transition-colors hover:border-[var(--mail-brass)] hover:bg-white/[0.06] hover:text-[var(--mail-chassis-foreground)] xl:justify-start"
            }
            type="button"
          >
            <Plus className="size-4" />
            <span
              className={
                appearance === "manager" ? "inline" : "hidden xl:inline"
              }
            >
              Add account
            </span>
          </button>
        </Dialog.Trigger>
        <Dialog.Content className="mail-dialog mail-workspace max-w-[460px] gap-0 overflow-hidden rounded-[18px] border p-0">
          <div className="mail-chassis border-b px-6 py-5">
            <Dialog.Title className="font-serif text-2xl tracking-[-0.03em]">
              Add account
            </Dialog.Title>
            <Dialog.Description className="mt-1.5 max-w-sm text-xs leading-5 text-[var(--mail-chassis-foreground)]/70">
              Choose a provider. You can connect more than one account from the
              same service.
            </Dialog.Description>
          </div>
          <div className="space-y-1.5 p-3">
            {PROVIDERS.map((provider) => (
              <ProviderOption
                connectedCount={countProviderAccounts(
                  accounts,
                  provider.provider,
                )}
                isConnecting={connectingProvider === provider.provider}
                key={provider.provider}
                onSelect={() => chooseProvider(provider.provider)}
                requiresReconnect={providerNeedsReconnect(
                  accounts,
                  provider.provider,
                )}
                {...provider}
              />
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Container>
      <ICloudConnectionDialog onOpenChange={setICloudOpen} open={icloudOpen} />
    </>
  );
}

function ProviderOption({
  connectedCount,
  description,
  icon: Icon,
  isConnecting,
  label,
  onSelect,
  requiresReconnect,
}: {
  connectedCount: number;
  description: string;
  icon: LucideIcon;
  isConnecting: boolean;
  label: string;
  onSelect: () => void;
  requiresReconnect: boolean;
}) {
  return (
    <button
      aria-label={getProviderAriaLabel(label, requiresReconnect)}
      className="group flex w-full items-center gap-3 rounded-[12px] border border-transparent px-3 py-3 text-left transition-colors hover:border-[var(--mail-seam)] hover:bg-[var(--mail-paper-soft)] hover:shadow-[var(--mail-shadow-raised)] disabled:cursor-wait disabled:opacity-60"
      disabled={isConnecting}
      onClick={onSelect}
      type="button"
    >
      <span className="mail-inset flex size-10 shrink-0 items-center justify-center rounded-[9px] border text-[var(--mail-ink-soft)]">
        <Icon className="size-[17px]" strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{label}</span>
          <ProviderStatus
            connectedCount={connectedCount}
            requiresReconnect={requiresReconnect}
          />
        </span>
        <span className="mail-label mt-0.5 block truncate text-xs">
          {getProviderDescription(description, requiresReconnect)}
        </span>
      </span>
      <ProviderOptionIcon isConnecting={isConnecting} />
    </button>
  );
}

function ProviderStatus({
  connectedCount,
  requiresReconnect,
}: {
  connectedCount: number;
  requiresReconnect: boolean;
}) {
  if (requiresReconnect) {
    return (
      <span className="font-mono text-[8px] tracking-[0.08em] text-[var(--mail-highlight)] uppercase">
        Reconnect required
      </span>
    );
  }
  if (connectedCount === 0) return null;
  return (
    <span className="mail-label font-mono text-[8px] tracking-[0.08em] uppercase">
      {connectedCount} connected
    </span>
  );
}

function ProviderOptionIcon({ isConnecting }: { isConnecting: boolean }) {
  if (isConnecting) return <Loader className="size-4 animate-spin" />;
  return (
    <ArrowRight className="size-4 text-[var(--mail-ink-soft)] transition-transform group-hover:translate-x-0.5" />
  );
}

function getProviderAriaLabel(label: string, requiresReconnect: boolean) {
  if (requiresReconnect) return `Reconnect or add another ${label} account`;
  return `Add ${label} account`;
}

function getProviderDescription(
  description: string,
  requiresReconnect: boolean,
) {
  if (requiresReconnect) return "Reconnect an account or add another";
  return description;
}

function countProviderAccounts(
  accounts: MailAccountView[],
  provider: ConnectableProvider,
) {
  return accounts.filter(
    (account) => account.provider === provider && !isDemoAccount(account),
  ).length;
}

function providerNeedsReconnect(
  accounts: MailAccountView[],
  provider: ConnectableProvider,
) {
  return accounts.some(
    (account) =>
      account.provider === provider &&
      !isDemoAccount(account) &&
      account.status === "reauthorization_required",
  );
}

function isDemoAccount(account: MailAccountView) {
  return account.isDemo === true || account.remoteAccountId.startsWith("demo-");
}

function getConnectionError(error: unknown, provider: ConnectableProvider) {
  if (error instanceof Error && error.message.trim()) return error.message;
  const labels = {
    gmail: "Gmail",
    icloud: "iCloud",
    microsoft: "Microsoft",
  } satisfies Record<ConnectableProvider, string>;
  return `Could not start ${labels[provider]} authorization.`;
}
