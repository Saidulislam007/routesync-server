import "dotenv/config";

const requiredVariables = ["MONGODB_URI"];

for (const variable of requiredVariables) {
  if (!process.env[variable]?.trim()) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
}

const parsedPort = Number(process.env.PORT ?? 5000);

if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
  throw new Error("PORT must be a valid number between 1 and 65535");
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parsedPort,
  mongodbUri: process.env.MONGODB_URI,
  databaseName: process.env.DB_NAME?.trim() || "routesync",
  clientUrl: process.env.CLIENT_URL?.trim() || "http://localhost:3000",
});
