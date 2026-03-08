import { Router } from "express";
import { createUserController, deleteUserController, listUsersController } from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { asyncHandler } from "../utils/async-handler";

export const userRouter = Router();

userRouter.use(authMiddleware, requireRole(["ADMIN"]));
userRouter.get("/", asyncHandler(listUsersController));
userRouter.post("/", asyncHandler(createUserController));
userRouter.delete("/:userId", asyncHandler(deleteUserController));
