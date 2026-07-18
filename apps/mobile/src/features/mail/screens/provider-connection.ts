export type OAuthMailProvider = "gmail" | "microsoft";

export const MOBILE_PROVIDER_REDIRECT_URL = "rodge-mail://provider-complete";

export function getMobileProviderReturnPath(provider: OAuthMailProvider) {
  return `/provider-complete?provider=${provider}`;
}

export function getProviderConnectionResult(
  provider: OAuthMailProvider,
  resultUrl: string | undefined,
) {
  if (!resultUrl) return "cancelled" as const;
  const result = new URL(resultUrl).searchParams.get("result");
  if (result !== "connected") return "error" as const;
  const completedProvider = new URL(resultUrl).searchParams.get("provider");
  return completedProvider === provider ? "connected" : "error";
}

export function getProviderConnectionMessage(
  provider: OAuthMailProvider,
  result: "cancelled" | "connected" | "error",
) {
  const label = provider === "gmail" ? "Gmail" : "Microsoft 365";
  if (result === "connected") {
    return `${label} connected. Initial sync is running.`;
  }
  if (result === "error") {
    return `${label} could not be connected. Try again.`;
  }
  return undefined;
}

export function getAccountReconnectMessage(
  address: string,
  result: "cancelled" | "connected" | "error",
) {
  if (result === "connected") {
    return `${address} reconnected. Mail sync is running.`;
  }
  if (result === "error") {
    return `Could not reconnect ${address}. Try again.`;
  }
  return undefined;
}
