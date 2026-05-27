import { Router } from "express";
import rateLimit from "express-rate-limit";
import { loginController, meController, registerAdminController, registerEmployeeController } from "../controllers/auth.controller";
import { env } from "../config/env";
import { authMiddleware } from "../middlewares/auth.middleware";
import { asyncHandler } from "../utils/async-handler";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Try again later." }
});

authRouter.post("/login", authLimiter, asyncHandler(loginController));
authRouter.post("/register-admin", authLimiter, asyncHandler(registerAdminController));
authRouter.post("/register-employee", authLimiter, asyncHandler(registerEmployeeController));
authRouter.get("/me", authMiddleware, asyncHandler(meController));
