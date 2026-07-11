import { spawn, spawnSync } from "node:child_process";
import { delimiter, dirname } from "node:path";

import { findSupportedNodeBinary } from "./node-runtime.mjs";

const port = process.env.PORT;
if (!port) throw new Error("Portless did not provide the web app port");

const portlessHostname = new URL(process.env.PORTLESS_URL).hostname;
const ownsPasskeyAlias = portlessHostname === "www.rodge-mail.local";

if (ownsPasskeyAlias) {
  const alias = spawnSync(
    "pnpm",
    ["exec", "portless", "alias", "rodge-mail", port],
    { stdio: "ignore" },
  );
  if (alias.status !== 0) {
    throw new Error("Could not register the rodge-mail.local passkey alias");
  }
}

const viteNode = findSupportedNodeBinary();
const viteNodeDirectory = dirname(viteNode);
const viteEnvironment = {
  ...process.env,
  PATH: [viteNodeDirectory, process.env.PATH].filter(Boolean).join(delimiter),
};

if (viteNode !== process.execPath) {
  const version = spawnSync(viteNode, ["-p", "process.versions.node"], {
    encoding: "utf8",
  }).stdout.trim();
  console.log(
    `Using Node ${version} for the TanStack Start development server.`,
  );
}

const vite = spawn("pnpm", ["exec", "vite", "dev"], {
  env: viteEnvironment,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => vite.kill(signal));
}

vite.on("exit", (code, signal) => {
  if (ownsPasskeyAlias) {
    const routes = spawnSync("pnpm", ["exec", "portless", "list"], {
      encoding: "utf8",
    });
    if (
      routes.status === 0 &&
      routes.stdout.includes(
        `https://rodge-mail.local  ->  localhost:${port}  (alias)`,
      )
    ) {
      spawnSync(
        "pnpm",
        ["exec", "portless", "alias", "--remove", "rodge-mail"],
        { stdio: "ignore" },
      );
    }
  }
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
