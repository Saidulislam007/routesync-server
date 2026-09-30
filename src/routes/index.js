import { Router } from "express";

import operationsRouter from "./operations.route.js";
import healthRouter from "./health.route.js";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/operations", operationsRouter);

export default apiRouter;
