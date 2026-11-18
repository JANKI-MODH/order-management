import { existsSync } from "node:fs";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const databaseDir = resolve("data/postgres");
const postgres = new EmbeddedPostgres({
  databaseDir,
  user: "northline",
  password: "northline",
  port: 5432,
  persistent: true,
  autoRehydrateSymlinks: true,
});

if (!existsSync(databaseDir)) {
  await postgres.initialise();
}

await postgres.start();

try {
  await postgres.createDatabase("northline");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes("already exists")) {
    throw error;
  }
}

console.log("PostgreSQL listening on localhost:5432, database northline");

async function shutdown() {
  await postgres.stop();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
