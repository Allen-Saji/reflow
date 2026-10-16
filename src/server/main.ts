import "dotenv/config";
import { buildApp } from "./app.js";
import { closeDb } from "../graph/store.js";
const app = await buildApp();
await app.listen({
  port: Number(process.env.PORT || 3410),
  host: process.env.HOST || "127.0.0.1",
});
console.log(`Reflow listening on port ${process.env.PORT || 3410}`);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await app.close();
    await closeDb();
    process.exit(0);
  });
