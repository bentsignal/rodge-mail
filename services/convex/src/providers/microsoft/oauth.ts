/* eslint-disable no-restricted-syntax, @typescript-eslint/consistent-type-assertions -- OAuth token responses are an external JSON boundary. */
import type { ProviderTokens } from "../types";
import { urls } from "../../urls";
import { providerEnv } from "../env";

export const MICROSOFT_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "User.Read",
  "Mail.ReadWrite",
  "Mail.Send",
] as const;

export class MicrosoftOAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MicrosoftOAuthError";
  }
}

export function getMicrosoftOAuthConfig() {
  const clientId = providerEnv.MICROSOFT_OAUTH_CLIENT_ID?.trim();
  const clientSecret = providerEnv.MICROSOFT_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Microsoft OAuth credentials are not configured");
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${urls.convex.site}/providers/microsoft/oauth/callback`,
    tenant: normalizeTenant(providerEnv.MICROSOFT_OAUTH_TENANT),
  };
}

export function buildMicrosoftAuthorizationUrl({
  clientId,
  redirectUri,
  state,
  codeChallenge,
  tenant,
}: ReturnType<typeof getMicrosoftOAuthConfig> & {
  state: string;
  codeChallenge: string;
}) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: MICROSOFT_SCOPES.join(" "),
    prompt: "select_account",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${authorityRoot(tenant)}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeMicrosoftAuthorizationCode(
  code: string,
  codeVerifier: string,
): Promise<ProviderTokens> {
  const config = getMicrosoftOAuthConfig();
  return await requestTokens(config.tenant, {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
    scope: MICROSOFT_SCOPES.join(" "),
  });
}

export async function refreshMicrosoftTokens(
  refreshToken: string,
): Promise<ProviderTokens> {
  const config = getMicrosoftOAuthConfig();
  const tokens = await requestTokens(config.tenant, {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: MICROSOFT_SCOPES.join(" "),
  });
  return {
    ...tokens,
    refreshToken: tokens.refreshToken ?? refreshToken,
  };
}

async function requestTokens(
  tenant: string,
  parameters: Record<string, string>,
) {
  const response = await fetch(`${authorityRoot(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(parameters).toString(),
  });
  const body = (await response.json()) as MicrosoftTokenResponse;
  if (!response.ok || !body.access_token) {
    throw new MicrosoftOAuthError(
      body.error ?? "oauth_exchange_failed",
      body.error_description ?? body.error ?? "Microsoft OAuth failed",
    );
  }
  return normalizeTokens(body);
}

function normalizeTokens(body: MicrosoftTokenResponse): ProviderTokens {
  if (!body.access_token) throw new Error("Microsoft omitted the access token");
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    tokenType: body.token_type ?? "Bearer",
    expiresAt: body.expires_in
      ? Date.now() + Math.max(0, body.expires_in - 60) * 1000
      : undefined,
    scopes: body.scope?.split(/\s+/u).filter(Boolean) ?? [...MICROSOFT_SCOPES],
  };
}

function normalizeTenant(value: string | undefined) {
  const normalized = value?.trim();
  const tenant = normalized?.length ? normalized : "common";
  if (
    !/^(?:common|organizations|consumers|[0-9a-f-]{36}|[a-z0-9.-]+)$/iu.test(
      tenant,
    )
  ) {
    throw new Error("MICROSOFT_OAUTH_TENANT is invalid");
  }
  return tenant.toLowerCase();
}

function authorityRoot(tenant: string) {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}`;
}

interface MicrosoftTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}
