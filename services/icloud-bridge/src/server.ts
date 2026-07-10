import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

import { verifySetupToken } from "@rodge-mail/convex/providers/icloud/protocol";

import { completeBridgeConnection } from "./convex-client";
import { encryptCredential } from "./credentials";
import { saveAccount } from "./database";
import { env } from "./env";
import { verifyCredentials } from "./icloud-client";

const MAX_FORM_BYTES = 64_000;

export function startServer() {
  const server = createServer((request, response) => {
    void handleRequest(request, response);
  });
  server.listen(env.PORT, () => {
    console.info(`[icloud-bridge] listening on port ${env.PORT}`);
  });
  return server;
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
) {
  try {
    await route(request, response);
  } catch (error) {
    sendHtml(response, 500, setupPage({ error: safeMessage(error) }));
  }
}

async function route(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, protocolVersion: 1 }));
    return;
  }
  if (url.pathname !== "/connect/icloud") {
    sendHtml(response, 404, setupPage({ error: "Page not found" }));
    return;
  }
  if (request.method === "GET") {
    await renderSetup(response, url.searchParams.get("token") ?? "");
    return;
  }
  if (request.method === "POST") {
    await connect(request, response);
    return;
  }
  response.writeHead(405, { allow: "GET, POST" });
  response.end();
}

async function renderSetup(response: ServerResponse, token: string) {
  const setup = await verifySetupToken(token, env.ICLOUD_BRIDGE_SIGNING_SECRET);
  if (!setup) {
    sendHtml(
      response,
      401,
      setupPage({ error: "This setup link is invalid or expired." }),
    );
    return;
  }
  sendHtml(response, 200, setupPage({ token }));
}

async function connect(request: IncomingMessage, response: ServerResponse) {
  const body = await readBody(request);
  const form = new URLSearchParams(body);
  const setupToken = form.get("token") ?? "";
  const address = (form.get("address") ?? "").trim().toLowerCase();
  const displayName = (form.get("displayName") ?? "").trim() || undefined;
  const password = (form.get("password") ?? "").trim();
  const setup = await verifySetupToken(
    setupToken,
    env.ICLOUD_BRIDGE_SIGNING_SECRET,
  );
  if (!setup) {
    sendHtml(
      response,
      401,
      setupPage({ error: "This setup link is invalid or expired." }),
    );
    return;
  }
  if (!address.includes("@") || password.length < 8) {
    sendHtml(
      response,
      400,
      setupPage({
        token: setupToken,
        error: "Enter your iCloud Mail address and app-specific password.",
      }),
    );
    return;
  }
  try {
    const verification = await verifyCredentials({ address, password });
    const bridgeAccountId = stableBridgeAccountId(setup.ownerId, address);
    await saveAccount({
      bridgeAccountId,
      ownerId: setup.ownerId,
      address,
      displayName,
      imapUsername: verification.imapUsername,
      encryptedCredential: encryptCredential(password, bridgeAccountId),
    });
    const completed = await completeBridgeConnection({
      setupToken,
      bridgeAccountId,
      address,
      displayName,
    });
    response.writeHead(303, { location: completed.returnUrl });
    response.end();
  } catch (error) {
    sendHtml(
      response,
      400,
      setupPage({
        token: setupToken,
        error: `iCloud could not verify this connection: ${safeMessage(error)}`,
      }),
    );
  }
}

async function readBody(request: IncomingMessage) {
  request.setEncoding("utf8");
  const chunks = new Array<string>();
  let size = 0;
  for await (const chunk of request) {
    if (typeof chunk !== "string") throw new Error("Invalid setup request");
    size += Buffer.byteLength(chunk);
    if (size > MAX_FORM_BYTES) throw new Error("Setup request is too large");
    chunks.push(chunk);
  }
  return chunks.join("");
}

function sendHtml(response: ServerResponse, status: number, html: string) {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy":
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  });
  response.end(html);
}

function stableBridgeAccountId(ownerId: string, address: string) {
  const bytes = createHash("sha256")
    .update(`${ownerId}:${address.toLowerCase()}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function safeMessage(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 300)
    : "Unexpected error";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setupPage(input: { token?: string; error?: string }) {
  const token = escapeHtml(input.token ?? "");
  const error = input.error
    ? `<div class="error" role="alert">${escapeHtml(input.error)}</div>`
    : "";
  const form = input.token
    ? `<form method="post" action="/connect/icloud">
        <input type="hidden" name="token" value="${token}">
        <label>Mail address<input required name="address" type="email" autocomplete="email" placeholder="you@icloud.com"></label>
        <label>Your name <span>optional</span><input name="displayName" autocomplete="name" placeholder="Name shown in Rodge Mail"></label>
        <label>App-specific password<input required name="password" type="password" autocomplete="off" placeholder="xxxx-xxxx-xxxx-xxxx"></label>
        <button type="submit">Verify and connect <b>→</b></button>
      </form>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect iCloud · Rodge Mail</title><style>
:root{color-scheme:light dark;font-family:Georgia,serif;background:#e9e1d4;color:#20251f}*{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 16% 8%,#fff8e9 0,transparent 32%),linear-gradient(145deg,#eee5d7,#d9cdbb)}main{width:min(100%,480px);background:#f9f4ea;border:1px solid #c9baa5;border-radius:28px;padding:38px;box-shadow:0 30px 80px #68523e2e}header{display:flex;align-items:center;gap:14px}.mark{display:grid;place-items:center;width:48px;height:48px;border-radius:15px;background:#20251f;color:#f7f1e6;font-style:italic;font-size:24px}.eyebrow{margin:0;font:10px ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:#8a7968}h1{margin:3px 0 0;font-size:26px;letter-spacing:-.02em}p{font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.55;color:#62584e}.steps{margin:26px 0;padding:18px 20px;border-left:3px solid #b38736;background:#f1e7d5;font-size:14px}.steps a{color:#8a6828}form{display:grid;gap:17px}label{display:grid;gap:7px;font:600 12px ui-sans-serif,system-ui,sans-serif;color:#554b42}label span{font-weight:400;color:#8e8276}input{width:100%;border:1px solid #cfc2b1;border-radius:12px;background:#fffaf2;padding:13px 14px;color:#20251f;font:14px ui-sans-serif,system-ui,sans-serif;outline:none}input:focus{border-color:#b38736;box-shadow:0 0 0 3px #b3873622}button{margin-top:4px;border:0;border-radius:999px;background:#20251f;color:#f7f1e6;padding:14px 18px;font:700 14px ui-sans-serif,system-ui,sans-serif;cursor:pointer}button:hover{background:#343a32}.error{margin:20px 0;border-radius:12px;background:#f2d8cd;color:#8c3f2b;padding:12px 14px;font:13px/1.4 ui-sans-serif,system-ui,sans-serif}.privacy{font-size:12px;color:#82766b;margin:22px 0 0}@media(prefers-color-scheme:dark){:root{background:#181b17;color:#f7f1e6}body{background:radial-gradient(circle at 18% 5%,#36382f,transparent 34%),#181b17}main{background:#242720;border-color:#45483e}.steps{background:#2f3026}p{color:#bcb2a5}input{background:#1d201b;border-color:#4a4d44;color:#f7f1e6}}
</style></head><body><main><header><div class="mark">R</div><div><p class="eyebrow">Private mail bridge</p><h1>Connect iCloud Mail</h1></div></header>${error}<div class="steps">Generate a dedicated password at <a href="https://account.apple.com" target="_blank" rel="noreferrer">account.apple.com</a> under <strong>Sign-In and Security → App-Specific Passwords</strong>. Never enter your primary Apple Account password here.</div>${form}<p class="privacy">Your app-specific password goes directly to this bridge, is verified against Apple’s IMAP and SMTP servers, then stored with AES-256-GCM encryption. Convex and the Rodge Mail clients never receive it.</p></main></body></html>`;
}
