import { spawnSync } from "node:child_process";

const routes = spawnSync("pnpm", ["exec", "portless", "list"], {
  encoding: "utf8",
});

const aliases = ["www.rodge-mail", "rodge-mail"];
for (const alias of aliases) {
  const hostname = `${alias}.local`;
  const escapedHostname = hostname.replaceAll(".", "\\.");
  const isStaleAlias = new RegExp(
    `^\\s*https:\\/\\/${escapedHostname}\\s+->.+\\(alias\\)\\s*$`,
    "m",
  ).test(routes.stdout);
  if (routes.status !== 0 || !isStaleAlias) continue;

  const removal = spawnSync(
    "pnpm",
    ["exec", "portless", "alias", "--remove", alias],
    { stdio: "inherit" },
  );
  if (removal.status !== 0) {
    throw new Error(`Could not remove the stale ${hostname} alias`);
  }
}
