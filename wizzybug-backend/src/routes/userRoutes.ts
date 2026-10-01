import express from "express";
import { deleteUser, getUsers, updateCurrentUser } from "../controllers/userController";
import { adminOnly, protect } from "../middleware/authMiddleware";

const router = express.Router();

router.patch("/me", protect, updateCurrentUser);
router.route("/").get(protect, getUsers);
router.delete("/:id", protect, adminOnly, deleteUser);

export default router;
