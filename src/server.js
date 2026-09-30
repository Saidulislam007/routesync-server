import app from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

let server;
let isShuttingDown = false;

async function startServer() {
  try {
    await connectDatabase();
    console.log(`Connected to MongoDB database: ${env.databaseName}`);

    server = app.listen(env.port, () => {
      console.log(
        `RouteSync API is running at http://localhost:${env.port} in ${env.nodeEnv} mode`,
      );
    });
  } catch (error) {
    console.error("Failed to start RouteSync API:", error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`${signal} received. Shutting down gracefully...`);

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  await disconnectDatabase();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

startServer();
