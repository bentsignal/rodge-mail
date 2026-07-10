const WEB_ORIGIN = "https://rodge-mail.vercel.app";
const AUTH_ORIGIN = "https://colorful-ostrich-734.convex.site";
const APPLE_APP_ID = "39K6A9FP99.com.bentsignal.rodgemail";
const ANDROID_PACKAGE = "com.bentsignal.rodgemail";

const checks = [
  check("production web", `${WEB_ORIGIN}/`, (response) => response.ok),
  check(
    "Convex auth",
    `${AUTH_ORIGIN}/api/auth/ok`,
    async (response) => response.ok && (await response.json()).ok === true,
  ),
  check(
    "Apple passkey association",
    `${WEB_ORIGIN}/.well-known/apple-app-site-association`,
    async (response) => {
      if (!response.ok) return false;
      const body = await response.json();
      return body.webcredentials?.apps?.includes(APPLE_APP_ID) === true;
    },
  ),
  check(
    "Android passkey association",
    `${WEB_ORIGIN}/.well-known/assetlinks.json`,
    async (response) => {
      if (!response.ok) return false;
      const body = await response.json();
      return (
        Array.isArray(body) &&
        body.some(
          (entry) =>
            entry.target?.package_name === ANDROID_PACKAGE &&
            entry.target?.sha256_cert_fingerprints?.length > 0,
        )
      );
    },
  ),
];

const results = await Promise.all(checks);
for (const result of results) {
  console.log(`${result.ok ? "✓" : "✗"} ${result.name}${result.detail}`);
}
if (results.some((result) => !result.ok)) process.exitCode = 1;

function check(name, url, validate) {
  return fetch(url, { redirect: "follow" })
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
