import cors from "cors";
import express from "express";
import { connectDatabase } from "./config/database.js";

import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFoundHandler } from "./middlewares/notFound.js";
import apiRouter from "./routes/index.js";

const app = express();

app.disable("x-powered-by");

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === env.clientUrl) {
        callback(null, true);
        return;
      }

      callback(new Error("Request blocked by CORS policy"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to the RouteSync API",
  });
});

app.use("/api/v1", async (_req, _res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    next(error);
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
