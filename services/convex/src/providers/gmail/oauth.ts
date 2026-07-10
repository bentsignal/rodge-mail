import type { ProviderTokens } from "../types";
import { urls } from "../../urls";
/* eslint-disable no-restricted-syntax, @typescript-eslint/consistent-type-assertions -- OAuth token responses require explicit external-data contracts. */
import { providerEnv } from "../env";

const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

export class GoogleOAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GoogleOAuthError";
  }
}

export function getGoogleOAuthConfig() {
  const clientId = providerEnv.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = providerEnv.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured");
  }
  return {
    clientId,
    clientSecret,
    redirectUri: `${urls.convex.site}/providers/gmail/oauth/callback`,
  };
}

export function buildGoogleAuthorizationUrl({
  clientId,
  redirectUri,
  state,
  codeChallenge,
}: ReturnType<typeof getGoogleOAuthConfig> & {
  state: string;
  codeChallenge: string;
}) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${GOOGLE_AUTHORIZATION_ENDPOINT}?${params.toString()}`;
}

export async function exchangeAuthorizationCode(
  code: string,
  codeVerifier: string,
): Promise<ProviderTokens> {
  const config = getGoogleOAuthConfig();
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }).toString(),
  });
  const body = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !body.access_token) {
    throw new GoogleOAuthError(
      body.error ?? "oauth_exchange_failed",
      body.error_description ?? body.error ?? "OAuth exchange failed",
    );
  }
  return normalizeTokens(body);
}

export async function refreshGoogleTokens(
  refreshToken: string,
): Promise<ProviderTokens> {
  const config = getGoogleOAuthConfig();
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const body = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !body.access_token) {
    throw new GoogleOAuthError(
      body.error ?? "token_refresh_failed",
      body.error_description ?? body.error ?? "Token refresh failed",
    );
  }
  return { ...normalizeTokens(body), refreshToken };
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

function normalizeTokens(body: GoogleTokenResponse): ProviderTokens {
  if (!body.access_token) throw new Error("Google omitted the access token");
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    tokenType: body.token_type ?? "Bearer",
    expiresAt: body.expires_in
      ? Date.now() + Math.max(0, body.expires_in - 60) * 1000
      : undefined,
    scopes: body.scope?.split(/\s+/u).filter(Boolean) ?? [GMAIL_SCOPE],
  };
}
