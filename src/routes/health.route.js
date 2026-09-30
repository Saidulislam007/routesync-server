import { Router } from "express";

import { getHealthStatus } from "../controllers/health.controller.js";

const healthRouter = Router();

healthRouter.get("/", getHealthStatus);

export default healthRouter;
