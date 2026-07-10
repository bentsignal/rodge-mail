import { closeDatabase, migrateDatabase } from "./database";
import { startServer } from "./server";
import { startWorker, stopWorker } from "./worker";

await migrateDatabase();
const server = startServer();
startWorker();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void shutdown());
}

async function shutdown() {
  stopWorker();
  server.close();
  await closeDatabase();
  process.exit(0);
}
