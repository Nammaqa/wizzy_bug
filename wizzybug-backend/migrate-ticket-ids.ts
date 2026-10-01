import mongoose from "mongoose";
import dotenv from "dotenv";
import Project from "./src/models/Project";
import Ticket from "./src/models/Ticket";

dotenv.config();

type TicketIdRow = {
  _id: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  defectId?: string;
};

const applyChanges = process.argv.includes("--apply");

const run = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("Missing MONGO_URI in environment.");

  await mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB_NAME });

  try {
    const [projects, tickets] = await Promise.all([
      Project.find().select("name key").lean(),
      Ticket.find()
        .select("project defectId createdAt")
        .sort({ createdAt: 1, _id: 1 })
        .lean(),
    ]);
    const projectsById = new Map(projects.map((project) => [String(project._id), project]));
    const ticketsByProject = new Map<string, TicketIdRow[]>();

    for (const ticket of tickets) {
      const projectId = String(ticket.project);
      const projectTickets = ticketsByProject.get(projectId) || [];
      projectTickets.push(ticket as TicketIdRow);
      ticketsByProject.set(projectId, projectTickets);
    }

    const updates: Array<{
      ticketId: mongoose.Types.ObjectId;
      oldDefectId: string;
      newDefectId: string;
    }> = [];

    for (const [projectId, projectTickets] of ticketsByProject) {
      const project = projectsById.get(projectId);
      if (!project) continue;

      const prefix = project.name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      projectTickets.forEach((ticket, index) => {
        const newDefectId = `${prefix}-${String(index + 1).padStart(2, "0")}`;
        if (ticket.defectId === newDefectId) return;
        updates.push({
          ticketId: ticket._id,
          oldDefectId: ticket.defectId || "(missing)",
          newDefectId,
        });
      });
    }

    for (const update of updates) {
      console.log(
        `${update.oldDefectId} -> ${update.newDefectId} (${update.ticketId})`,
      );
    }

    if (applyChanges && updates.length) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await Ticket.bulkWrite(
            updates.map(({ ticketId }) => ({
              updateOne: {
                filter: { _id: ticketId },
                update: { $set: { defectId: `__MIGRATING__${ticketId}` } },
              },
            })),
            { session },
          );
          await Ticket.bulkWrite(
            updates.map(({ ticketId, newDefectId }) => ({
              updateOne: {
                filter: { _id: ticketId },
                update: { $set: { defectId: newDefectId } },
              },
            })),
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
    }

    if (!updates.length) {
      console.log("No bug ID updates are needed.");
    } else {
      console.log(
        `${applyChanges ? "Updated" : "Previewed"} ${updates.length} bug ID(s).${
          applyChanges ? "" : " Run with --apply to save these IDs."
        }`,
      );
    }
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error("Bug ID migration failed:", error);
  process.exitCode = 1;
});