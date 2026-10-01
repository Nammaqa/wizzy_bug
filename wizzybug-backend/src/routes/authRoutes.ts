import express from "express";
import {
  registerUser,
  loginUser,
  inviteUser,
  acceptInvite,
  forgotPassword,
  resetPassword,
  verifyEmail,
} from "../controllers/authController";
import { protect, adminOnly } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
// Only admins can invite new teammates.
router.post("/invite", protect, adminOnly, inviteUser);
router.post("/accept-invite", acceptInvite);

export default router;
