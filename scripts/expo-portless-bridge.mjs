#!/usr/bin/env node

import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";

const publicPort = Number(process.env.PORT);

if (!Number.isInteger(publicPort) || publicPort <= 0) {
  console.error("expo-portless-bridge must be run by portless with PORT set.");
  process.exit(1);
}

const command = process.argv.slice(2);

if (command.length === 0) {
  console.error("Usage: expo-portless-bridge <expo command...>");
  process.exit(1);
}

const publicHost =
  process.env.PORTLESS_URL?.replace(/^https?:\/\//, "").replace(/\/.*$/, "") ??
  "localhost";
const publicProto = process.env.PORTLESS_URL?.startsWith("https://")
  ? "https"
  : "http";
const publicOrigin = `${publicProto}://${publicHost}`;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
          return;
        }
        reject(new Error("Could not allocate a local port."));
      });
    });
  });
}

const metroPort = await getFreePort();
const metroOrigin = `http://127.0.0.1:${metroPort}`;

function rewriteBody(body) {
  return normalizeNativeBundleUrls(
    body
    .replaceAll(`https://127.0.0.1:${metroPort}`, publicOrigin)
    .replaceAll(`http://127.0.0.1:${metroPort}`, publicOrigin)
    .replaceAll(`https://localhost:${metroPort}`, publicOrigin)
    .replaceAll(`http://localhost:${metroPort}`, publicOrigin)
    .replaceAll(`https://${publicHost}:${metroPort}`, publicOrigin)
    .replaceAll(`http://${publicHost}:${metroPort}`, publicOrigin)
    .replaceAll(`${publicHost}:${metroPort}`, publicHost)
    .replaceAll(`127.0.0.1:${metroPort}`, publicHost)
      .replaceAll(`localhost:${metroPort}`, publicHost),
  );
}

function normalizeNativeBundleUrls(body) {
  return body.replaceAll(
    /https?:\/\/[^\s"'<>\\]+?\.bundle\?[^\s"'<>\\]+/g,
    (value) => {
      const url = new URL(value);
      const platform = url.searchParams.get("platform");

      if (platform === "ios" || platform === "android") {
        url.searchParams.set("lazy", "false");
      }

      return url.toString();
    },
  );
}

function getMetroRequestPath(req) {
  const requestUrl = new URL(req.url ?? "/", publicOrigin);
  const platform = requestUrl.searchParams.get("platform");

  if (
    requestUrl.pathname.endsWith(".bundle") &&
    (platform === "ios" || platform === "android")
  ) {
    requestUrl.searchParams.set("lazy", "false");
  }

  return `${requestUrl.pathname}${requestUrl.search}`;
}

function proxyRequest(req, res) {
  const headers = { ...req.headers };
  headers.host = `${publicHost}:${metroPort}`;
  headers["x-forwarded-host"] = publicHost;
  headers["x-forwarded-proto"] = publicProto;
  headers["x-forwarded-port"] = publicProto === "https" ? "443" : "80";
  delete headers["accept-encoding"];

  const proxyReq = http.request(
    {
      hostname: "127.0.0.1",
      port: metroPort,
      path: getMetroRequestPath(req),
      method: req.method,
      headers,
    },
    (proxyRes) => {
      const chunks = [];
      proxyRes.on("data", (chunk) => chunks.push(chunk));
      proxyRes.on("end", () => {
        const responseHeaders = { ...proxyRes.headers };
        const contentType = String(responseHeaders["content-type"] ?? "");
        const body = Buffer.concat(chunks);
        const shouldRewrite =
          contentType.includes("application/json") ||
          contentType.includes("+json") ||
          contentType.includes("text/") ||
          contentType.includes("application/javascript");

        if (!shouldRewrite) {
          res.writeHead(proxyRes.statusCode ?? 502, responseHeaders);
          res.end(body);
          return;
        }

        const rewritten = Buffer.from(rewriteBody(body.toString("utf8")));
        delete responseHeaders["content-length"];
        delete responseHeaders["content-encoding"];
        res.writeHead(proxyRes.statusCode ?? 502, responseHeaders);
        res.end(rewritten);
      });
    },
  );

  proxyReq.on("error", (error) => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`Expo bridge proxy error: ${error.message}`);
  });

  req.pipe(proxyReq);
}

function proxyUpgrade(req, socket, head) {
  const headers = { ...req.headers };
  headers.host = `${publicHost}:${metroPort}`;
  headers["x-forwarded-host"] = publicHost;
  headers["x-forwarded-proto"] = publicProto;
  headers["x-forwarded-port"] = publicProto === "https" ? "443" : "80";

  const headerLines = Object.entries(headers)
    .filter(([, value]) => value !== undefined)
    .flatMap(([key, value]) =>
      Array.isArray(value)
        ? value.map((item) => `${key}: ${item}`)
        : [`${key}: ${value}`],
    )
    .join("\r\n");

  const upstream = net.connect(metroPort, "127.0.0.1", () => {
    upstream.write(
      `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headerLines}\r\n\r\n`,
    );
    if (head.length > 0) {
      upstream.write(head);
    }
    socket.pipe(upstream).pipe(socket);
  });

  upstream.on("error", () => socket.destroy());
}

const server = http.createServer(proxyRequest);
server.on("upgrade", proxyUpgrade);

server.listen(publicPort, "127.0.0.1", () => {
  console.log(
    `Expo Portless bridge: ${publicOrigin} -> ${metroOrigin} (native URLs rewritten)`,
  );
});

const child = spawn(command[0], [...command.slice(1), "--port", String(metroPort)], {
  env: {
    ...process.env,
    PORT: String(metroPort),
    REACT_NATIVE_PACKAGER_HOSTNAME: publicHost,
  },
  stdio: "inherit",
});

function shutdown(signal) {
  child.kill(signal);
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

child.on("exit", (code, signal) => {
  server.close(() => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
});
