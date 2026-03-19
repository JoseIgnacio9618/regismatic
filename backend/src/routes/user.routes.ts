import { Router } from "express";
import {
  assignEmployeeManagerController,
  createUserController,
  deleteUserController,
  listUsersController,
  removeOwnProfilePhotoController,
  removeUserProfilePhotoController,
  updateOwnProfilePhotoController,
  updateUserProfilePhotoController
} from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { profilePhotoUpload } from "../middlewares/upload.middleware";
import { asyncHandler } from "../utils/async-handler";

export const userRouter = Router();

userRouter.use(authMiddleware);
userRouter.post("/me/photo", profilePhotoUpload.single("photo"), asyncHandler(updateOwnProfilePhotoController));
userRouter.delete("/me/photo", asyncHandler(removeOwnProfilePhotoController));

userRouter.use(requireRole(["ADMIN", "SUPERADMIN"]));
userRouter.get("/", asyncHandler(listUsersController));
userRouter.post("/", asyncHandler(createUserController));
userRouter.patch("/:userId/manager", asyncHandler(assignEmployeeManagerController));
userRouter.post("/:userId/photo", profilePhotoUpload.single("photo"), asyncHandler(updateUserProfilePhotoController));
userRouter.delete("/:userId/photo", asyncHandler(removeUserProfilePhotoController));
userRouter.delete("/:userId", asyncHandler(deleteUserController));
