/* eslint-disable no-restricted-syntax -- The persisted session file is an untyped boundary with an explicit runtime guard. */
import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const defaultUrls = {
  convexCloud: "https://dazzling-dog-633.convex.cloud",
  convexSite: "https://dazzling-dog-633.convex.site",
  web: "https://www.rodge-mail.local",
};

export interface CliSession {
  cookie: string;
  createdAt: number;
}

export interface CliUrls {
  convexCloud: string;
  convexSite: string;
  web: string;
}

export function resolveCliUrls(
  environment: NodeJS.ProcessEnv = process.env,
): CliUrls {
  return {
    convexCloud:
      environment.RODGE_MAIL_CONVEX_CLOUD_URL ?? defaultUrls.convexCloud,
    convexSite:
      environment.RODGE_MAIL_CONVEX_SITE_URL ?? defaultUrls.convexSite,
    web: environment.RODGE_MAIL_WEB_URL ?? defaultUrls.web,
  };
}

export function sessionFilePath(environment: NodeJS.ProcessEnv = process.env) {
  const configured = environment.RODGE_MAIL_CONFIG_DIR;
  const directory = configured
    ? resolve(configured)
    : join(environment.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "rodge");
  return join(directory, "session.json");
}

export async function readSession(
  environment: NodeJS.ProcessEnv = process.env,
) {
  try {
    const parsed: unknown = JSON.parse(
      await readFile(sessionFilePath(environment), "utf8"),
    );
    if (!isCliSession(parsed)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export async function writeSession(
  session: CliSession,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const path = sessionFilePath(environment);
  const directory = dirname(path);
  await mkdir(directory, { mode: 0o700, recursive: true });
  await chmod(directory, 0o700);
  await writeFile(path, `${JSON.stringify(session, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(path, 0o600);
}

export async function removeSession(
  environment: NodeJS.ProcessEnv = process.env,
) {
  try {
    await unlink(sessionFilePath(environment));
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }
}

function isCliSession(value: unknown): value is CliSession {
  if (!value || typeof value !== "object") return false;
  return (
    "cookie" in value &&
    typeof value.cookie === "string" &&
    value.cookie.length > 0 &&
    "createdAt" in value &&
    typeof value.createdAt === "number" &&
    Number.isFinite(value.createdAt)
  );
}

function isMissingFile(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
