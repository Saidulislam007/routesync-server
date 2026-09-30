import { MongoClient, ServerApiVersion } from "mongodb";

import { env } from "./env.js";

let client;
let database;

export async function connectDatabase() {
  if (database) {
    return database;
  }

  client = new MongoClient(env.mongodbUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();
  await client.db("admin").command({ ping: 1 });

  database = client.db(env.databaseName);
  return database;
}

export function getDatabase() {
  if (!database) {
    throw new Error("Database is not connected. Call connectDatabase first.");
  }

  return database;
}

export async function disconnectDatabase() {
  if (!client) {
    return;
  }

  await client.close();
  client = undefined;
  database = undefined;
}
