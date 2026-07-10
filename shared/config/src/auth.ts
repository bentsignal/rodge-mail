export const sharedAuthIssuer: string | undefined = undefined;
export const sharedAuthJwksUri: string | undefined = undefined;

export interface PasskeyRegistrationContext {
  email: string;
  name: string;
}

export function createPasskeyRegistrationContext(
  input: PasskeyRegistrationContext,
) {
  const registration = normalizePasskeyRegistration(input);
  if (!registration) {
    throw new Error("Enter a valid name and email address.");
  }
  return JSON.stringify(registration);
}

export function parsePasskeyRegistrationContext(
  context: string | null | undefined,
) {
  if (!context) return undefined;
  try {
    return normalizePasskeyRegistration(JSON.parse(context));
  } catch {
    return undefined;
  }
}

function normalizePasskeyRegistration(value: unknown) {
  if (!isRecord(value)) return undefined;
  const name = normalizeName(value.name);
  const email = normalizeEmail(value.email);
  if (!name || !email) return undefined;
  return { email, name };
}

function normalizeName(value: unknown) {
  if (typeof value !== "string") return undefined;
  const name = value.trim().replace(/\s+/gu, " ");
  if (!name || name.length > 100) return undefined;
  return name;
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return undefined;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    return undefined;
  }
  return email;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
