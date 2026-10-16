import { Request, Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/authMiddleware";
import User from "../models/User";
import Project from "../models/Project";
import Ticket from "../models/Ticket";
import { isValidUserName, normalizeUserName } from "../utils/userName";

const normalizeEmail = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const isGmailAddress = (email: string): boolean => {
  const [localPart, domain] = email.split("@");
  return email.length <= 254 && domain === "gmail.com" && localPart.length <= 64 &&
    !localPart.includes("..") && /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?$/.test(localPart);
};

export const updateCurrentUser = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const name = normalizeUserName(req.body.name);
    const email = normalizeEmail(req.body.email);

    if (!isValidUserName(name)) {
      res.status(400).json({ message: "Name must be 2 to 40 characters and contain letters only" });
      return;
    }
    if (!isGmailAddress(email)) {
      res.status(400).json({ message: "Enter a valid @gmail.com email address" });
      return;
    }
    if (!req.user) {
      res.status(401).json({ message: "Not authorized" });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser && String(existingUser._id) !== String(req.user._id)) {
      res.status(409).json({ message: "An account with this Gmail address already exists" });
      return;
    }

    req.user.name = name;
    req.user.email = email;
    await req.user.save();
    res.json({
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    });
  } catch (error) {
    console.error("[updateCurrentUser]", error);
    res.status(500).json({ message: "Could not update profile" });
  }
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: Record<string, any> = {};

    // By default, hide invites that haven't been accepted yet (e.g. for an
    // "assign to developer" dropdown). Pass ?includePending=true for the
    // admin's user management page, which should show invite status too.
    if (req.query.includePending !== "true") {
      filter.status = { $ne: "pending" };
    }
    if (req.query.role) {
      filter.role = req.query.role;
    }

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

export const deleteUser = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid user ID" });
      return;
    }

    if (String(req.user?._id) === id) {
      res.status(400).json({ message: "You cannot delete your own account" });
      return;
    }

    const user = await User.findById(id).select("role");
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        res.status(400).json({ message: "The last admin account cannot be deleted" });
        return;
      }
    }

    await Promise.all([
      Project.updateMany({ members: user._id }, { $pull: { members: user._id } }),
      Ticket.updateMany({ assignees: user._id }, { $pull: { assignees: user._id } }),
      Ticket.updateMany({ assignee: user._id }, { $unset: { assignee: "" } }),
    ]);
    await User.findByIdAndDelete(user._id);

    res.json({ message: "User deleted" });
  } catch (error) {
    console.error("[deleteUser]", error);
    res.status(500).json({ message: "Could not delete user" });
  }
};
