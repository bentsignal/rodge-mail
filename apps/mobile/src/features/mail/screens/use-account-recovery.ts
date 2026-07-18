import { useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { useAction, useMutation } from "convex/react";

import { api } from "@rodge-mail/convex/api";

import type { MobileMailAccount } from "../lib/convex-mail";
import { toConvexId } from "../lib/convex-id";
import {
  getAccountReconnectMessage,
  getMobileProviderReturnPath,
  getProviderConnectionResult,
  MOBILE_PROVIDER_REDIRECT_URL,
} from "./provider-connection";

export function useAccountSyncRetry(account: MobileMailAccount) {
  const syncGmailNow = useMutation(api.accounts.mutations.syncGmailNow);
  const syncICloudNow = useMutation(api.accounts.mutations.syncICloudNow);
  const syncMicrosoftNow = useMutation(api.accounts.mutations.syncMicrosoftNow);
  const [isRetrying, setIsRetrying] = useState(false);
  const [message, setMessage] = useState<string>();

  async function retry() {
    setIsRetrying(true);
    setMessage(undefined);
    try {
      const args = { accountId: toConvexId<"mailAccounts">(account.id) };
      if (account.provider === "gmail") await syncGmailNow(args);
      else if (account.provider === "icloud") await syncICloudNow(args);
      else await syncMicrosoftNow(args);
      setMessage(`Sync started for ${account.address}.`);
    } catch (error) {
      setMessage(getRecoveryError(error, account.address));
    }
    setIsRetrying(false);
  }

  return {
    clearMessage: () => setMessage(undefined),
    isRetrying,
    message,
    retry,
  };
}

export function useAccountReconnect(account: MobileMailAccount) {
  const connectGmail = useAction(api.accounts.actions.connectGmail);
  const connectMicrosoft = useAction(api.accounts.actions.connectMicrosoft);
  const connectICloud = useAction(api.providers.icloud.actions.connect);
  const [icloudPassword, setICloudPassword] = useState("");
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [message, setMessage] = useState<string>();
  const [showICloudForm, setShowICloudForm] = useState(false);

  async function reconnectOAuth() {
    const provider = account.provider === "gmail" ? "gmail" : "microsoft";
    setIsReconnecting(true);
    setMessage(undefined);
    try {
      const startAuthorization =
        provider === "gmail" ? connectGmail : connectMicrosoft;
      const authorization = await startAuthorization({
        loginHint: account.address,
        returnPath: getMobileProviderReturnPath(provider),
      });
      const session = await WebBrowser.openAuthSessionAsync(
        authorization.authorizationUrl,
        MOBILE_PROVIDER_REDIRECT_URL,
      );
      const result = getProviderConnectionResult(
        provider,
        session.type === "success" ? session.url : undefined,
      );
      setMessage(getAccountReconnectMessage(account.address, result));
    } catch (error) {
      setMessage(getRecoveryError(error, account.address));
    }
    setIsReconnecting(false);
  }

  async function submitICloud() {
    setIsReconnecting(true);
    setMessage(undefined);
    try {
      await connectICloud({
        address: account.address,
        password: icloudPassword,
      });
      setICloudPassword("");
      setShowICloudForm(false);
      setMessage(getAccountReconnectMessage(account.address, "connected"));
    } catch (error) {
      setMessage(getRecoveryError(error, account.address));
    }
    setIsReconnecting(false);
  }

  function start() {
    if (account.provider === "icloud") {
      setMessage(undefined);
      setShowICloudForm((current) => !current);
      return;
    }
    void reconnectOAuth();
  }

  return {
    canSubmitICloud: icloudPassword.trim().length > 0,
    clearMessage: () => setMessage(undefined),
    isReconnecting,
    message,
    setICloudPassword,
    showICloudForm,
    start,
    submitICloud,
  };
}

function getRecoveryError(error: unknown, address: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return `Could not update ${address}. Try again.`;
}
