import { Router, type IRouter } from "express";
import healthRouter from "./health";
import novaRouter from "./nova";

const router: IRouter = Router();

router.use(healthRouter);
router.use(novaRouter);

export default router;
