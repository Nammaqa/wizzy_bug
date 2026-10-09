import mongoose from "mongoose";
import { Response } from "express";
import Ticket, { ITicket } from "../models/Ticket";
import Project from "../models/Project";
import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";
import { sendBugAssignmentEmail } from "../utils/mailer";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";

const normalizeAssigneeIds = (value: unknown): mongoose.Types.ObjectId[] => {
  const ids = Array.isArray(value)
    ? value
        .filter(
          (item): item is string | number =>
            typeof item === "string" || typeof item === "number",
        )
        .map(String)
    : typeof value === "string" || typeof value === "number"
      ? [String(value)]
      : [];

  return ids.map((id) => new mongoose.Types.ObjectId(id));
};

const getTicketAssigneeIds = (ticket: ITicket): string[] =>
  [...new Set([
    ...(ticket.assignees || []).map(String),
    ...(ticket.assignee ? [String(ticket.assignee)] : []),
  ])];

const notifyAssignees = async (
  ticket: ITicket,
  assignedIds: mongoose.Types.ObjectId[],
  previouslyAssignedIds: string[],
  assignedBy: string,
  knownProject?: { name: string; key?: string },
  event: "assigned" | "updated" = "assigned",
  changedFields: string[] = [],
): Promise<void> => {
  const previousIds = new Set(previouslyAssignedIds);
  const newlyAssignedIds = [...new Set(assignedIds.map(String))]
    .filter((id) => !previousIds.has(id));
  if (!newlyAssignedIds.length) return;

  const [assignees, project] = await Promise.all([
    User.find({ _id: { $in: newlyAssignedIds } }).select("name email"),
    knownProject || Project.findById(ticket.project).select("name key"),
  ]);
  if (!project) {
    console.error(`[assignment email] Project not found for bug ${ticket.defectId || ticket._id}`);
    return;
  }

  const appUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.VITE_APP_URL || "http://localhost:5173";
  await Promise.all(assignees.filter((assignee) => assignee.email).map(async (assignee) => {
    try {
      const delivery = await sendBugAssignmentEmail({
        to: assignee.email,
        assigneeName: assignee.name,
        assignedBy,
        bugId: ticket.defectId || String(ticket._id),
        title: ticket.title,
        description: ticket.description,
        projectName: project.name,
        projectKey: project.key,
        priority: ticket.priority,
        severity: ticket.severity,
        appUrl,
        event,
        changedFields,
      });
      console.info(
        `[assignment email] Sent ${event} notification for ${ticket.defectId || ticket._id} to ${assignee.email} via ${delivery.message}`,
      );
    } catch (error) {
      console.error(
        `[assignment email] Failed for ${ticket.defectId || ticket._id} to ${assignee.email}:`,
        error,
      );
    }
  }));
};

export const getTickets = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const filter: Record<string, any> = {};
    if (req.query.project) filter.project = req.query.project;
    if (req.query.assignee) {
      filter.$or = [
        { assignees: req.query.assignee },
        { assignee: req.query.assignee },
      ];
    }
    if (req.query.status) filter.status = req.query.status;

    const tickets = await Ticket.find(filter)
      .populate("project", "name key")
      .populate("creator", "name email")
      .populate("assignees", "name email")
      .populate("assignee", "name email")
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

export const createTicket = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const {
      title,
      description,
      severity,
      priority,
      project,
      assignee,
      assignees,
      screenshotBase64,
      screenshotMimeType,
      environment,
      moduleFeatureName,
      buildAppVersion,
      releaseVersion,
      reproductionRate,
      expectedResult,
      actualResult,
      defectType,
      typeOfApplication,
      browser,
      browserVersion,
    } = req.body;

    const projectId = project;
    const creatorId = req.user?._id;

    if (!projectId) {
      res.status(400).json({ message: "Project is required" });
      return;
    }

    if (!creatorId) {
      res.status(400).json({ message: "Creator is required" });
      return;
    }

    const existingTicketCount = await Ticket.countDocuments({
      project: projectId,
    });
    await Project.updateOne(
      { _id: projectId, issueSequence: { $lt: existingTicketCount } },
      { $set: { issueSequence: existingTicketCount } },
    );
    const projectDoc = await Project.findByIdAndUpdate(
      projectId,
      { $inc: { issueSequence: 1 } },
      { new: true },
    );
    if (!projectDoc) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
    const projectPrefix = projectDoc.name
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    const defectId = `${projectPrefix}-${String(projectDoc.issueSequence).padStart(2, "0")}`;

    const creatorDoc =
      req.user || (creatorId ? await User.findById(creatorId) : null);
    const normalizedAssignees = normalizeAssigneeIds(assignees ?? assignee);

    let screenshot;
    let imageUrl;
    let imagePublicId;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
      );
      imageUrl = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;
    } else if (screenshotBase64 && screenshotMimeType) {
      screenshot = {
        data: Buffer.from(screenshotBase64, "base64"),
        contentType: screenshotMimeType,
      };
    }

    const ticket = await Ticket.create({
      defectId,
      title,
      description,
      severity: severity || "Minor",
      priority: priority ? priority.toLowerCase() : "medium",
      project: projectId,
      assignees: normalizedAssignees,
      assignee: normalizedAssignees[0] || undefined,
      creator: creatorId,
      screenshot,
      imageUrl,
      imagePublicId,
      environment,
      moduleFeatureName,
      buildAppVersion,
      releaseVersion,
      reproductionRate,
      expectedResult,
      actualResult,
      defectType,
      typeOfApplication,
      browser,
      browserVersion,
      history: [
        {
          type: "created",
          message: normalizedAssignees.length
            ? `Bug reported and assigned to ${normalizedAssignees.length} team member${normalizedAssignees.length > 1 ? "s" : ""}`
            : "Bug reported",
          actor: creatorId,
          actorName: creatorDoc?.name || "Unknown user",
          createdAt: new Date(),
        },
      ],
    });

    await notifyAssignees(
      ticket,
      normalizedAssignees,
      [],
      creatorDoc?.name || "A team member",
      { name: projectDoc.name, key: projectDoc.key },
    );

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate("project", "name key")
      .populate("creator", "name email")
      .populate("assignees", "name email")
      .populate("assignee", "name email");

    res.status(201).json(populatedTicket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const getTicketScreenshot = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket || !ticket.screenshot || !ticket.screenshot.data) {
      res.status(404).send("Not found");
      return;
    }
    res.set("Content-Type", ticket.screenshot.contentType as string);
    res.send(ticket.screenshot.data);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

export const updateTicket = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      res.status(404).json({ message: "Ticket not found" });
      return;
    }
    const previouslyAssignedIds = getTicketAssigneeIds(ticket);
    const originalFieldValues: Record<string, string> = {
      Title: String(ticket.title ?? ""),
      Description: String(ticket.description ?? ""),
      Severity: String(ticket.severity ?? ""),
      Priority: String(ticket.priority ?? ""),
      Project: String(ticket.project ?? ""),
      Environment: String(ticket.environment ?? ""),
      "Module / Feature": String(ticket.moduleFeatureName ?? ""),
      "Build / App Version": String(ticket.buildAppVersion ?? ""),
      "Release Version": String(ticket.releaseVersion ?? ""),
      "Reproduction Rate": String(ticket.reproductionRate ?? ""),
      "Expected Result": String(ticket.expectedResult ?? ""),
      "Actual Result": String(ticket.actualResult ?? ""),
      "Defect Type": String(ticket.defectType ?? ""),
      "Type of Application": String(ticket.typeOfApplication ?? ""),
      Browser: String(ticket.browser ?? ""),
      "Browser Version": String(ticket.browserVersion ?? ""),
      Assignees: previouslyAssignedIds.slice().sort().join(","),
    };
    const originalAttachmentState = [
      ...ticket.attachments.map((attachment) => String(attachment._id)),
      ticket.imageUrl ? "legacy-image" : "",
      ticket.screenshot ? "legacy-screenshot" : "",
    ].sort().join(",");

    const {
      title,
      description,
      severity,
      priority,
      project,
      assignee,
      assignees,
      deleteAttachmentIds,
      environment,
      moduleFeatureName,
      buildAppVersion,
      releaseVersion,
      reproductionRate,
      expectedResult,
      actualResult,
      defectType,
      typeOfApplication,
      browser,
      browserVersion,
    } = req.body;

    const hasAssigneeUpdate = assignees !== undefined || assignee !== undefined;
    const normalizedAssignees = hasAssigneeUpdate
      ? normalizeAssigneeIds(assignees ?? assignee)
      : null;

    const uploadedFiles = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;
    const newFiles = [
      ...(uploadedFiles?.images || []),
      ...(uploadedFiles?.image || []),
    ];

    const attachmentIdsToDelete = (() => {
      try {
        const value =
          typeof deleteAttachmentIds === "string"
            ? JSON.parse(deleteAttachmentIds)
            : deleteAttachmentIds;
        return Array.isArray(value) ? value.map(String) : [];
      } catch {
        return [];
      }
    })();

    for (const attachmentId of attachmentIdsToDelete) {
      const attachment = ticket.attachments.find(
        (item) => String(item._id) === attachmentId,
      );
      if (attachment) {
        await deleteFromCloudinary(attachment.publicId);
        ticket.attachments = ticket.attachments.filter(
          (item) => String(item._id) !== attachmentId,
        ) as typeof ticket.attachments;
      } else if (attachmentId === "legacy-image" && ticket.imageUrl) {
        if (ticket.imagePublicId) {
          await deleteFromCloudinary(ticket.imagePublicId);
        }
        ticket.imageUrl = undefined;
        ticket.imagePublicId = undefined;
      } else if (attachmentId === "legacy-screenshot" && ticket.screenshot) {
        ticket.screenshot = undefined;
      }
    }

    for (const file of newFiles) {
      let uploadResult;
      try {
        uploadResult = await uploadToCloudinary(file.buffer, file.originalname);
      } catch (error) {
        console.error("[updateTicket] Attachment upload failed:", error);
        res.status(502).json({
          message: "Attachment upload failed. Please check the file and try again.",
        });
        return;
      }
      ticket.attachments.push({
        fileName: file.originalname,
        contentType: file.mimetype || "application/octet-stream",
        secureUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        resourceType:
          uploadResult.resource_type || file.mimetype.split("/")[0] || "raw",
      });
    }

    if (title !== undefined) ticket.title = title;
    if (description !== undefined) ticket.description = description;
    if (severity !== undefined) ticket.severity = severity;
    if (priority !== undefined) ticket.priority = priority.toLowerCase();
    if (project !== undefined) ticket.project = project;
    if (normalizedAssignees) {
      if (normalizedAssignees) {
        ticket.assignees = normalizedAssignees;
        ticket.assignee = normalizedAssignees[0] || undefined;
      }
    }
    if (environment !== undefined) ticket.environment = environment;
    if (moduleFeatureName !== undefined)
      ticket.moduleFeatureName = moduleFeatureName;
    if (buildAppVersion !== undefined) ticket.buildAppVersion = buildAppVersion;
    if (releaseVersion !== undefined) ticket.releaseVersion = releaseVersion;
    if (reproductionRate !== undefined)
      ticket.reproductionRate = reproductionRate;
    if (expectedResult !== undefined) ticket.expectedResult = expectedResult;
    if (actualResult !== undefined) ticket.actualResult = actualResult;
    if (defectType !== undefined) ticket.defectType = defectType;
    if (typeOfApplication !== undefined)
      ticket.typeOfApplication = typeOfApplication;
    if (browser !== undefined) ticket.browser = browser;
    if (browserVersion !== undefined) ticket.browserVersion = browserVersion;

    ticket.history.push({
      type: "update",
      message: "Ticket details updated",
      actor: req.user?._id,
      actorName: req.user?.name || "Unknown user",
      createdAt: new Date(),
    });

    await ticket.save();

    const currentFieldValues: Record<string, string> = {
      Title: String(ticket.title ?? ""),
      Description: String(ticket.description ?? ""),
      Severity: String(ticket.severity ?? ""),
      Priority: String(ticket.priority ?? ""),
      Project: String(ticket.project ?? ""),
      Environment: String(ticket.environment ?? ""),
      "Module / Feature": String(ticket.moduleFeatureName ?? ""),
      "Build / App Version": String(ticket.buildAppVersion ?? ""),
      "Release Version": String(ticket.releaseVersion ?? ""),
      "Reproduction Rate": String(ticket.reproductionRate ?? ""),
      "Expected Result": String(ticket.expectedResult ?? ""),
      "Actual Result": String(ticket.actualResult ?? ""),
      "Defect Type": String(ticket.defectType ?? ""),
      "Type of Application": String(ticket.typeOfApplication ?? ""),
      Browser: String(ticket.browser ?? ""),
      "Browser Version": String(ticket.browserVersion ?? ""),
      Assignees: getTicketAssigneeIds(ticket).sort().join(","),
    };
    const changedFields = Object.keys(originalFieldValues).filter(
      (field) => originalFieldValues[field] !== currentFieldValues[field],
    );
    const currentAttachmentState = [
      ...ticket.attachments.map((attachment) => String(attachment._id)),
      ticket.imageUrl ? "legacy-image" : "",
      ticket.screenshot ? "legacy-screenshot" : "",
    ].sort().join(",");
    if (originalAttachmentState !== currentAttachmentState) {
      changedFields.push("Attachments");
    }

    if (normalizedAssignees) {
      await notifyAssignees(
        ticket,
        normalizedAssignees,
        previouslyAssignedIds,
        req.user?.name || "A team member",
      );
    }

    if (changedFields.length) {
      const previouslyAssigned = new Set(previouslyAssignedIds);
      const retainedAssignees = getTicketAssigneeIds(ticket)
        .filter((id) => previouslyAssigned.has(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      await notifyAssignees(
        ticket,
        retainedAssignees,
        [],
        req.user?.name || "A team member",
        undefined,
        "updated",
        changedFields,
      );
    }

    const populated = await ticket.populate([
      { path: "project", select: "name key" },
      { path: "creator", select: "name email" },
      { path: "assignees", select: "name email" },
      { path: "assignee", select: "name email" },
    ]);

    res.json(populated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const getTicketById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate("project", "name key")
      .populate("creator", "name email")
      .populate("assignees", "name email")
      .populate("assignee", "name email");

    if (!ticket) {
      res.status(404).json({ message: "Ticket not found" });
      return;
    }
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

export const updateTicketStatus = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { status, note } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      res.status(404).json({ message: "Ticket not found" });
      return;
    }

    const previousStatus = ticket.status;
    ticket.status = status;
    ticket.history.push({
      type: "status",
      message: `Status changed from "${previousStatus.replace("_", " ")}" to "${String(status).replace("_", " ")}"${note ? `: ${note}` : ""}`,
      actor: req.user?._id,
      actorName: req.user?.name || "System",
      createdAt: new Date(),
    });
    await ticket.save();

    const populated = await ticket.populate([
      { path: "project", select: "name key" },
      { path: "creator", select: "name email" },
      { path: "assignees", select: "name email" },
      { path: "assignee", select: "name email" },
    ]);

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// Assign or reassign a ticket for any authenticated user.
export const assignTicket = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { assignees, assignee } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      res.status(404).json({ message: "Ticket not found" });
      return;
    }
    const previouslyAssignedIds = getTicketAssigneeIds(ticket);

    // Assignment is independent from the workflow status.
    const currentStatus = ticket.status;
    const normalizedAssignees = normalizeAssigneeIds(assignees ?? assignee);
    const assigneeDocs = normalizedAssignees.length
      ? await User.find({ _id: { $in: normalizedAssignees } })
      : [];

    if (
      normalizedAssignees.length &&
      assigneeDocs.length !== normalizedAssignees.length
    ) {
      res
        .status(400)
        .json({ message: "One or more assignee users were not found" });
      return;
    }

    ticket.assignees = normalizedAssignees as any;
    ticket.assignee = normalizedAssignees[0] as any;
    ticket.status = currentStatus;
    const assigneeNames = assigneeDocs.map((doc) => doc.name).join(", ");
    ticket.history.push({
      type: "assignment",
      message: assigneeNames
        ? `Assigned to ${assigneeNames}`
        : "Assignment cleared",
      actor: req.user?._id,
      actorName: req.user?.name || "Admin",
      createdAt: new Date(),
    });
    await ticket.save();

    await notifyAssignees(
      ticket,
      normalizedAssignees,
      previouslyAssignedIds,
      req.user?.name || "A team member",
    );

    const populated = await ticket.populate([
      { path: "project", select: "name key" },
      { path: "creator", select: "name email" },
      { path: "assignees", select: "name email" },
      { path: "assignee", select: "name email" },
    ]);

    res.json(populated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Save/update the "fix description" notes shown on the bug detail page.
export const updateFixNotes = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { fixDescription } = req.body;
    const normalizedFixDescription =
      typeof fixDescription === "string" ? fixDescription.trim() : "";
    if (!normalizedFixDescription) {
      res.status(400).json({ message: "Fix description is required" });
      return;
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      res.status(404).json({ message: "Ticket not found" });
      return;
    }

    ticket.fixDescription = normalizedFixDescription;
    ticket.history.push({
      type: "update",
      message: `Fix description updated: ${normalizedFixDescription}`,
      actor: req.user?._id,
      actorName: req.user?.name || "Unknown user",
      createdAt: new Date(),
    });
    await ticket.save();

    const populated = await ticket.populate([
      { path: "project", select: "name key" },
      { path: "creator", select: "name email" },
      { path: "assignees", select: "name email" },
      { path: "assignee", select: "name email" },
    ]);

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// Add a timestamped comment/update note to a ticket (any authenticated user).
export const addTicketComment = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      res.status(400).json({ message: "Comment text is required" });
      return;
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      res.status(404).json({ message: "Ticket not found" });
      return;
    }

    ticket.comments.push({
      author: req.user?._id as any,
      authorName: req.user?.name || "Unknown user",
      text: text.trim(),
      createdAt: new Date(),
    });
    await ticket.save();

    const populated = await ticket.populate([
      { path: "project", select: "name key" },
      { path: "creator", select: "name email" },
      { path: "assignees", select: "name email" },
      { path: "assignee", select: "name email" },
    ]);

    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};
