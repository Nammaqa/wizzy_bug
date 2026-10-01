import { PRIORITY_LABELS, SEVERITY_LABELS, STATUS_LABELS } from "./constants";

export const initialsOf = (name = "") =>
  name.trim()
    ? name
        .trim()
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

export const statusLabel = (status) => STATUS_LABELS[status] || status;

export const priorityLabel = (priority) => {
  const normalizedPriority = String(priority || "").trim().toLowerCase();
  if (PRIORITY_LABELS[normalizedPriority]) {
    return PRIORITY_LABELS[normalizedPriority];
  }

  const matchingPriority = Object.keys(PRIORITY_LABELS).find((key) => {
    const label = PRIORITY_LABELS[key].toLowerCase().replace(/[^a-z]+/g, "");
    const value = normalizedPriority.replace(/[^a-z]+/g, "");
    return label === value;
  });

  if (matchingPriority) {
    return PRIORITY_LABELS[matchingPriority];
  }

  return priority
    ? priority.charAt(0).toUpperCase() + priority.slice(1)
    : "P3-Medium";
};

const legacyPrioritySeverity = {
  critical: "Critical",
  high: "Major",
  medium: "Minor",
  low: "Cosmetic",
};

export const severityLabel = (severity, priority) => {
  const normalizedSeverity = String(severity || "").trim().toLowerCase();
  const selectedSeverity = SEVERITY_LABELS.find(
    (label) => label.toLowerCase() === normalizedSeverity,
  );
  return selectedSeverity || legacyPrioritySeverity[priority] || "Minor";
};

export const severityClass = (severity) =>
  String(severity || "minor")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const pdfText = (value) =>
  String(value ?? "")
    .replace(/â€™/g, "'")
    .replace(/â€“|â€”/g, "-")
    .replace(/â€¦/g, "...")
    .replace(/Â·/g, "-")
    .replace(/[^\x20-\x7E\n]/g, "")
    .trim();

export function formatBug(ticket) {
  const priority = (ticket.priority || "medium").toLowerCase();
  const status = (ticket.status || "open").toLowerCase();
  const rawId = ticket._id || ticket.id || ticket.rawId || null;
  const assignees = Array.isArray(ticket.assignees)
    ? ticket.assignees
    : ticket.assignee
      ? [ticket.assignee]
      : [];
  const assigneeNames = assignees.map((assignee) => assignee?.name || assignee).filter(Boolean);
  const attachments = (ticket.attachments || []).map((attachment) => ({
    id: String(attachment._id || attachment.id),
    fileName: attachment.fileName || "Attachment",
    contentType: attachment.contentType || "application/octet-stream",
    url: attachment.secureUrl || attachment.url,
  }));
  if (ticket.imageUrl) {
    const fileName = decodeURIComponent(
      ticket.imageUrl.split("/").pop()?.split("?")[0] || "uploaded-image",
    );
    attachments.unshift({
      id: "legacy-image",
      fileName,
      contentType: "image/*",
      url: ticket.imageUrl,
    });
  }
  if (ticket.screenshot) {
    attachments.unshift({
      id: "legacy-screenshot",
      fileName: "screenshot.png",
      contentType: ticket.screenshot.contentType || "image/png",
      url: null,
    });
  }

  return {
    id: ticket.defectId || (ticket._id
      ? ticket._id.substring(ticket._id.length - 6).toUpperCase()
      : "WZ-000000"),
    rawId: rawId ? String(rawId) : null,
    title: ticket.title,
    desc: ticket.description,
    severity: severityLabel(ticket.severity, priority),
    priority,
    status,
    project: ticket.project?.name || "Unassigned project",
    projectId: ticket.project?._id || ticket.project || null,
    projectKey: ticket.project?.key || "",
    reporter: ticket.creator?.name || "System",
    reporterId: ticket.creator?._id || null,
    assignees,
    assignee: assigneeNames.length ? assigneeNames.join(", ") : "Unassigned",
    assigneeIds: assignees.map((assignee) => assignee?._id || assignee).filter(Boolean),
    assigneeId: assignees[0]?._id || assignees[0] || null,
    date: ticket.createdAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    comments: (ticket.comments || []).length,
    commentList: ticket.comments || [],
    history: ticket.history || [],
    hasScreenshot: !!ticket.screenshot || !!ticket.imageUrl || attachments.length > 0,
    imageUrl: ticket.imageUrl || null,
    attachments,
    fixDescription: ticket.fixDescription || "",
    environment: ticket.environment,
    moduleFeatureName: ticket.moduleFeatureName,
    buildAppVersion: ticket.buildAppVersion,
    releaseVersion: ticket.releaseVersion,
    reproductionRate: ticket.reproductionRate,
    expectedResult: ticket.expectedResult,
    actualResult: ticket.actualResult,
    defectType: ticket.defectType,
    typeOfApplication: ticket.typeOfApplication,
    browser: ticket.browser,
    browserVersion: ticket.browserVersion,
  };
}

export function isAssignedToUser(bug, user) {
  if (!user) return false;
  const userId = user._id ? String(user._id) : "";
  const userEmail = user.email ? String(user.email).toLowerCase() : "";
  const userName = user.name ? String(user.name).trim() : "";

  if (userId && (bug.assigneeIds || []).some((id) => String(id) === userId)) {
    return true;
  }
  if (
    Array.isArray(bug.assignees) &&
    bug.assignees.some((assignee) => {
      const assigneeId = assignee?._id ? String(assignee._id) : "";
      const assigneeEmail = assignee?.email
        ? String(assignee.email).toLowerCase()
        : "";
      const assigneeName = assignee?.name ? String(assignee.name).trim() : "";
      return (
        (userId && assigneeId && assigneeId === userId) ||
        (userEmail && assigneeEmail && assigneeEmail === userEmail) ||
        (userName && assigneeName && assigneeName === userName)
      );
    })
  ) {
    return true;
  }

  const assigneeText = bug.assignee ? String(bug.assignee) : "";
  if (userName && assigneeText) {
    const names = assigneeText.split(",").map((name) => name.trim().toLowerCase());
    if (names.includes(userName.toLowerCase())) return true;
  }
  return Boolean(userEmail && assigneeText && assigneeText.toLowerCase().includes(userEmail));
}

export function isReportedByUser(bug, user) {
  if (!bug || !user) return false;
  const userId = user._id ? String(user._id) : "";
  const reporterId = bug.reporterId ? String(bug.reporterId) : "";
  if (userId && reporterId) return userId === reporterId;

  const userName = user.name ? String(user.name).trim().toLowerCase() : "";
  const reporterName = bug.reporter ? String(bug.reporter).trim().toLowerCase() : "";
  return Boolean(userName && reporterName && userName === reporterName);
}

export function buildTimeline(bug) {
  const historyItems = (bug.history || []).map((history) => ({
    kind: "history",
    type: history.type,
    message: history.message,
    actorName: history.actorName || "System",
    createdAt: history.createdAt,
  }));
  const commentItems = (bug.commentList || []).map((comment) => ({
    kind: "comment",
    message: comment.text,
    actorName: comment.authorName || "Unknown user",
    createdAt: comment.createdAt,
  }));
  return [...historyItems, ...commentItems].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
}
