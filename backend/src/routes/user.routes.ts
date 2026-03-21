import { Router } from "express";
import {
  assignEmployeeManagerController,
  createTeamJoinRequestController,
  createUserController,
  deleteUserController,
  getUserProfilePhotoController,
  listTeamJoinRequestsController,
  listUsersController,
  removeOwnProfilePhotoController,
  removeUserProfilePhotoController,
  reviewTeamJoinRequestController,
  updateOwnProfilePhotoController,
  updateUserProfilePhotoController
} from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { profilePhotoUpload } from "../middlewares/upload.middleware";
import { asyncHandler } from "../utils/async-handler";

export const userRouter = Router();

userRouter.use(authMiddleware);
userRouter.get("/:userId/photo", asyncHandler(getUserProfilePhotoController));
userRouter.post("/me/photo", profilePhotoUpload.single("photo"), asyncHandler(updateOwnProfilePhotoController));
userRouter.delete("/me/photo", asyncHandler(removeOwnProfilePhotoController));
userRouter.get("/team-join-requests", asyncHandler(listTeamJoinRequestsController));
userRouter.post("/team-join-requests", asyncHandler(createTeamJoinRequestController));
userRouter.post("/team-join-requests/:requestId/review", asyncHandler(reviewTeamJoinRequestController));

userRouter.use(requireRole(["ADMIN", "SUPERADMIN"]));
userRouter.get("/", asyncHandler(listUsersController));
userRouter.post("/", asyncHandler(createUserController));
userRouter.patch("/:userId/manager", asyncHandler(assignEmployeeManagerController));
userRouter.post("/:userId/photo", profilePhotoUpload.single("photo"), asyncHandler(updateUserProfilePhotoController));
userRouter.delete("/:userId/photo", asyncHandler(removeUserProfilePhotoController));
userRouter.delete("/:userId", asyncHandler(deleteUserController));
