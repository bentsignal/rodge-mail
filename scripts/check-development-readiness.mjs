import { access, readFile } from "node:fs/promises";
import { get } from "node:https";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";

const localEnv = await readLocalEnv();

const WEB_ORIGIN = process.env.RODGE_WEB_ORIGIN ?? "https://www.rodge-mail.local";
const MOBILE_ORIGIN =
  process.env.RODGE_MOBILE_ORIGIN ?? "https://mobile.rodge-mail.local";
const AUTH_ORIGIN = process.env.CONVEX_SITE_URL ?? localEnv.CONVEX_SITE_URL;

const checks = [
  checkHttp("Portless web", `${WEB_ORIGIN}/`, (response) =>
    [200, 301, 302, 303, 307, 308].includes(response.status),
  ),
  checkHttp("Expo development server", `${MOBILE_ORIGIN}/`, (response) =>
    response.ok,
  ),
  AUTH_ORIGIN
    ? checkHttp(
        "Convex development auth",
        `${AUTH_ORIGIN}/api/auth/ok`,
        async (response) => response.ok && (await response.json()).ok === true,
      )
    : Promise.resolve({
        name: "Convex development auth",
        ok: false,
        detail: " (CONVEX_SITE_URL is not configured)",
      }),
  checkDesktopApp(),
];

const results = await Promise.all(checks);
for (const result of results) {
  console.log(`${result.ok ? "✓" : "✗"} ${result.name}${result.detail}`);
}
if (results.some((result) => !result.ok)) process.exitCode = 1;

function checkHttp(name, url, validate) {
  return request(url)
    .then(async (response) => ({
      name,
      ok: await validate(response),
      detail: ` (${response.status} ${url})`,
    }))
    .catch((error) => ({
      name,
      ok: false,
      detail: ` (${error instanceof Error ? error.message : "request failed"})`,
    }));
}

function request(url) {
  return new Promise((resolve, reject) => {
    const request = get(
      url,
      {
        rejectUnauthorized: !new URL(url).hostname.endsWith(".local"),
        timeout: 10_000,
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const status = response.statusCode ?? 0;
          resolve({
            status,
            ok: status >= 200 && status < 300,
            json: async () => JSON.parse(body),
          });
        });
      },
    );
    request.on("error", reject);
    request.on("timeout", () => request.destroy(new Error("request timed out")));
  });
}

async function checkDesktopApp() {
  if (process.platform !== "darwin") {
    return {
      name: "Installed desktop app",
      ok: true,
      detail: " (skipped outside macOS)",
    };
  }

  const appPaths = [
    "/Applications/Rodge Mail.app",
    join(homedir(), "Applications", "Rodge Mail.app"),
  ];
  for (const appPath of appPaths) {
    try {
      await access(appPath);
      return {
        name: "Installed desktop app",
        ok: true,
        detail: ` (${appPath})`,
      };
    } catch {}
  }

  return {
    name: "Installed desktop app",
    ok: false,
    detail: ` (${appPaths.join(" or ")})`,
  };
}

async function readLocalEnv() {
  try {
    return parseEnv(await readFile("services/convex/.env.local", "utf8"));
  } catch {
    return {};
  }
}
