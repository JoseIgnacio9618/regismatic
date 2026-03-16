import { Router } from "express";
import { loginController, meController, registerAdminController } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/async-handler";

export const authRouter = Router();

authRouter.post("/login", asyncHandler(loginController));
authRouter.post("/register-admin", asyncHandler(registerAdminController));
authRouter.get("/me", authMiddleware, asyncHandler(meController));
