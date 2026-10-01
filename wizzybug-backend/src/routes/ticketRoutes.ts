import express from "express";
import {
  getTickets,
  createTicket,
  getTicketById,
  updateTicket,
  updateTicketStatus,
  getTicketScreenshot,
  assignTicket,
  addTicketComment,
  updateFixNotes,
} from "../controllers/ticketController";
import { protect } from "../middleware/authMiddleware";
import { optionalUpload, requiredUpload } from "../middleware/uploadMiddleware";

const router = express.Router();

router
  .route("/")
  .get(protect, getTickets)
  .post(protect, requiredUpload, createTicket);

router
  .route("/:id")
  .get(protect, getTicketById)
  .put(protect, optionalUpload, updateTicket);

// No auth on the raw screenshot bytes -- it's rendered directly as <img src="..." )
// and doesn't carry an Authorization header, same as any static image URL.
router.route("/:id/screenshot").get(getTicketScreenshot);

router.route("/:id/status").put(protect, updateTicketStatus);

// Any authenticated user can assign or reassign a bug.
router.route("/:id/assign").put(protect, assignTicket);

router.route("/:id/comments").post(protect, addTicketComment);

router.route("/:id/fix-notes").put(protect, updateFixNotes);

export default router;
