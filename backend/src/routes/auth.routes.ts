import { Router } from "express";
import { loginController, meController, registerAdminController, registerEmployeeController } from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/async-handler";

export const authRouter = Router();

authRouter.post("/login", asyncHandler(loginController));
authRouter.post("/register-admin", asyncHandler(registerAdminController));
authRouter.post("/register-employee", asyncHandler(registerEmployeeController));
authRouter.get("/me", authMiddleware, asyncHandler(meController));
