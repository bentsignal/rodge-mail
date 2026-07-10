import { useState } from "react";
import { useAction } from "convex/react";
import { Link, Loader } from "lucide-react";

import { api } from "@rodge-mail/convex/api";
import { toast } from "@rodge-mail/ui-web/toast";

import type { MailAccountView } from "../types";

type ConnectableProvider = "gmail" | "icloud" | "microsoft";

export function ProviderConnectionButtons({
  accounts,
}: {
  accounts: MailAccountView[];
}) {
  const connectGmail = useAction(api.accounts.actions.connectGmail);
  const connectMicrosoft = useAction(api.accounts.actions.connectMicrosoft);
  const connectICloud = useAction(api.accounts.actions.connectICloud);
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

  async function connectICloudAccount() {
    setConnectingProvider("icloud");
    try {
      const result = await connectICloud({ returnPath: "/" });
      window.location.assign(result.setupUrl);
    } catch (error) {
      toast.error(getConnectionError(error, "icloud"));
      setConnectingProvider(undefined);
    }
  }

  return (
    <>
      <ProviderConnectionButton
        account={findAccount(accounts, "gmail")}
        isConnecting={connectingProvider === "gmail"}
        label="Gmail"
        onConnect={() =>
          void connectOAuthProvider("gmail", () =>
            connectGmail({ returnPath: "/" }),
          )
        }
      />
      <ProviderConnectionButton
        account={findAccount(accounts, "icloud")}
        isConnecting={connectingProvider === "icloud"}
        label="iCloud"
        onConnect={() => void connectICloudAccount()}
      />
      <ProviderConnectionButton
        account={findAccount(accounts, "microsoft")}
        isConnecting={connectingProvider === "microsoft"}
        label="Microsoft 365"
        onConnect={() =>
          void connectOAuthProvider("microsoft", () =>
            connectMicrosoft({ returnPath: "/" }),
          )
        }
      />
    </>
  );
}

function ProviderConnectionButton({
  account,
  isConnecting,
  label,
  onConnect,
}: {
  account: MailAccountView | undefined;
  isConnecting: boolean;
  label: string;
  onConnect: () => void;
}) {
  if (account && account.status !== "reauthorization_required") return null;
  const connectionLabel = `${account ? "Reconnect" : "Connect"} ${label}`;

  return (
    <button
      aria-label={connectionLabel}
      className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#b9ad9d] px-3 text-xs font-semibold text-[#756b60] transition hover:border-[#c76749] hover:text-[#a74f37] disabled:opacity-50 xl:justify-start dark:border-[#555a52] dark:text-[#aaa195]"
      disabled={isConnecting}
      onClick={onConnect}
      title={connectionLabel}
      type="button"
    >
      <ConnectionIcon isConnecting={isConnecting} />
      <span className="hidden xl:inline">{connectionLabel}</span>
    </button>
  );
}

function ConnectionIcon({ isConnecting }: { isConnecting: boolean }) {
  if (isConnecting) return <Loader className="size-3.5 animate-spin" />;
  return <Link className="size-3.5" />;
}

function findAccount(
  accounts: MailAccountView[],
  provider: ConnectableProvider,
) {
  return accounts.find((account) => account.provider === provider);
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
