import { Router } from "express";
import { loginController, meController } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/async-handler";

export const authRouter = Router();

authRouter.post("/login", asyncHandler(loginController));
authRouter.get("/me", authMiddleware, asyncHandler(meController));
