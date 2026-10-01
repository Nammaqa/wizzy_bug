import React, { useMemo, useState, useEffect } from "react";
import * as Icons from "lucide-react";
const {
  LayoutDashboard,
  Bug,
  Plus,
  Users,
  User,
  Settings,
  LogOut,
  Search,
  Bell,
  ChevronDown,
  ArrowUpRight,
  Clock3,
  CircleCheck,
  TriangleAlert,
  Filter,
  Download,
  Menu,
  X,
  ChevronRight,
  Paperclip,
  File: FileIcon,
  FileImage,
  FileVideo,
  FileText,
  Send,
  CalendarDays,
  BarChart3,
  FolderKanban,
  Activity,
  ShieldCheck,
  Eye,
  EyeOff,
  Moon,
  Sun,
  UserCog,
  Mail,
  ClipboardList,
  RefreshCcw,
  FolderPlus,
  ArrowLeft,
  Pencil,
} = Icons;
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { API, apiFetch, setToken } from "../config/api";
import { formatIST, formatISTLong, timeAgoIST, IST_TZ } from "../utils/date";
import {
  STATUS_LABELS,
  STATUS_VALUES,
  PRIORITY_LABELS,
  SEVERITY_LABELS,
  SEVERITY_TO_PRIORITY,
} from "../utils/constants";
import { Avatar, Logo, RoleBadge, Status } from "../components/Ui";
import {
  initialsOf,
  isAssignedToUser,
  priorityLabel,
  statusLabel,
  pdfText,
  severityClass,
} from "../utils/formatters";

const environmentOptions = [
  "Development",
  "QA",
  "UAT",
  "Staging",
  "Production",
];
const reproductionRateOptions = ["100%", "75%", "50%", "25%"];
const defectTypeOptions = [
  "Functional",
  "UI/UX",
  "Performance",
  "Security",
  "Integration",
  "Data Validation",
  "Accessibility",
  "API",
  "Mobile",
  "Database",
  "Regression",
  "Enhancement Request",
  "Other",
];

function buildTimeline(bug) {
  const historyItems = (bug.history || []).map((h) => ({
    kind: "history",
    type: h.type,
    message: h.message,
    actorName: h.actorName || "System",
    createdAt: h.createdAt,
  }));
  const commentItems = (bug.commentList || []).map((c) => ({
    kind: "comment",
    message: c.text,
    actorName: c.authorName || "Unknown user",
    createdAt: c.createdAt,
  }));
  return [...historyItems, ...commentItems].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
}

function Detail({
  bug,
  setSelected,
  updateStatus,
  addComment,
  updateBug,
  saveFixNotes,
  assignBug,
  users = [],
  user,
}) {
  const [next, setNext] = useState(bug.status);
  const [commentText, setCommentText] = useState("");
  const [fixDescription, setFixDescription] = useState("");
  const [savingFix, setSavingFix] = useState(false);
  const [savedFix, setSavedFix] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [attachmentsToUpload, setAttachmentsToUpload] = useState([]);
  const [attachmentUploadError, setAttachmentUploadError] = useState("");
  const [otherDefectType, setOtherDefectType] = useState("");
  const [editForm, setEditForm] = useState({
    title: bug.title || "",
    desc: bug.desc || "",
    severity: bug.severity || "Minor",
    priority: bug.priority || SEVERITY_TO_PRIORITY[bug.severity] || "medium",
    moduleFeatureName: bug.moduleFeatureName || "",
    environment: bug.environment || "",
    buildAppVersion: bug.buildAppVersion || "",
    releaseVersion: bug.releaseVersion || "",
    defectType: defectTypeOptions.includes(bug.defectType)
      ? bug.defectType
      : bug.defectType
        ? "Other"
        : "",
    reproductionRate: bug.reproductionRate || "",
    expectedResult: bug.expectedResult || "",
    actualResult: bug.actualResult || "",
    typeOfApplication: bug.typeOfApplication || "",
    browser: bug.browser || "",
    browserVersion: bug.browserVersion || "",
  });

  useEffect(() => {
    if (editing) return;

    setNext(bug.status);
    setEditForm({
      title: bug.title || "",
      desc: bug.desc || "",
      severity: bug.severity || "Minor",
      priority: bug.priority || SEVERITY_TO_PRIORITY[bug.severity] || "medium",
      moduleFeatureName: bug.moduleFeatureName || "",
      environment: bug.environment || "",
      buildAppVersion: bug.buildAppVersion || "",
      releaseVersion: bug.releaseVersion || "",
      defectType: bug.defectType || "",
      reproductionRate: bug.reproductionRate || "",
      expectedResult: bug.expectedResult || "",
      actualResult: bug.actualResult || "",
      typeOfApplication: bug.typeOfApplication || "",
      browser: bug.browser || "",
      browserVersion: bug.browserVersion || "",
    });
    setOtherDefectType(
      defectTypeOptions.includes(bug.defectType) ? "" : bug.defectType || "",
    );
    setAttachmentsToUpload([]);
    setAttachmentUploadError("");
  }, [bug, editing]);

  const canReassign = true;
  const timeline = buildTimeline(bug);
  const updateEditField = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const handleSend = async () => {
    if (!commentText.trim()) return;
    setBusy(true);
    try {
      await addComment(bug.rawId, commentText.trim());
      setCommentText("");
    } catch (e) {
      alert(e.message || "Could not post comment");
    }
    setBusy(false);
  };

  const handleStatusChange = async (value) => {
    setNext(value);
    setBusy(true);
    try {
      await updateStatus(bug.rawId, value);
    } catch (e) {
      alert(e.message || "Could not update status");
      setNext(bug.status);
    }
    setBusy(false);
  };

  const handleSaveFix = async () => {
    setSavingFix(true);
    try {
      await saveFixNotes(bug.rawId, fixDescription);
      setFixDescription("");
      setSavedFix(true);
      setTimeout(() => setSavedFix(false), 2000);
    } catch (e) {
      alert(e.message || "Could not save fix description");
    }
    setSavingFix(false);
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();
    if (!editForm.title.trim()) return;
    setBusy(true);
    try {
      await updateBug(bug.rawId, {
        ...editForm,
        defectType:
          editForm.defectType === "Other"
            ? otherDefectType.trim()
            : editForm.defectType,
        attachmentsToUpload,
      });
      setEditing(false);
    } catch (e) {
      alert(e.message || "Could not update bug details");
    }
    setBusy(false);
  };

  const handleReassign = async (userIds) => {
    setBusy(true);
    try {
      await assignBug(bug.rawId, userIds);
      setReassignOpen(false);
    } catch (e) {
      alert(e.message || "Could not reassign bug");
    }
    setBusy(false);
  };

  const exportBugPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const center = pageWidth / 2;

    doc.setTextColor(20);
    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text("BUG REPORT", center, 16, { align: "center" });
    doc.setFontSize(12);
    doc.text(pdfText(bug.title), center, 24, { align: "center" });
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(pdfText(`Generated: ${formatIST(new Date())}`), center, 31, {
      align: "center",
    });

    autoTable(doc, {
      startY: 38,
      theme: "grid",
      margin: { left: margin, right: margin },
      head: [["FIELD", "DETAIL"]],
      headStyles: {
        fillColor: [91, 70, 190],
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: "linebreak",
        valign: "middle",
      },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: "bold" },
        1: { cellWidth: pageWidth - margin * 2 - 45 },
      },
      body: [
        ["BUG ID", pdfText(bug.id)],
        ["STATUS", pdfText(statusLabel(bug.status))],
        ["SEVERITY", pdfText(bug.severity)],
        ["PROJECT", pdfText(bug.project)],
        ["REPORTER", pdfText(bug.reporter)],
        ["ASSIGNEE", pdfText(bug.assignee)],
        ["REPORTED (IST)", pdfText(formatIST(bug.createdAt))],
        ["LAST UPDATED (IST)", pdfText(formatIST(bug.updatedAt))],
        ["ENVIRONMENT", pdfText(bug.environment || "-")],
        ["MODULE / FEATURE", pdfText(bug.moduleFeatureName || "-")],
        [
          "BROWSER",
          pdfText(
            [bug.browser, bug.browserVersion].filter(Boolean).join(" ") || "-",
          ),
        ],
      ],
    });

    let y = doc.lastAutoTable.finalY + 8;
    const reportSections = [
      ["DESCRIPTION", bug.desc],
      ["EXPECTED RESULT", bug.expectedResult],
      ["ACTUAL RESULT", bug.actualResult],
      ["FIX DESCRIPTION", bug.fixDescription],
    ].filter(([, value]) => value);

    if (reportSections.length) {
      autoTable(doc, {
        startY: y,
        theme: "grid",
        margin: { left: margin, right: margin },
        head: [["REPORT SECTION", "CONTENT"]],
        headStyles: {
          fillColor: [91, 70, 190],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        styles: {
          fontSize: 9,
          cellPadding: 4,
          overflow: "linebreak",
          valign: "top",
        },
        columnStyles: {
          0: { cellWidth: 45, fontStyle: "bold" },
          1: { cellWidth: pageWidth - margin * 2 - 45 },
        },
        body: reportSections.map(([label, value]) => [label, pdfText(value)]),
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    if (timeline.length) {
      if (y > 260) y = 18;
      autoTable(doc, {
        startY: y,
        theme: "grid",
        head: [["WHEN (IST)", "WHO", "ACTIVITY"]],
        margin: { left: margin, right: margin },
        headStyles: {
          fillColor: [91, 70, 190],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
          overflow: "linebreak",
          valign: "top",
        },
        columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 35 } },
        body: timeline.map((t) => [
          pdfText(formatIST(t.createdAt)),
          pdfText(t.actorName),
          pdfText(t.message),
        ]),
      });
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`WizzyBug | Page ${page} of ${pageCount}`, center, 290, {
        align: "center",
      });
    }

    doc.save(`${bug.id}_wizzyBug.pdf`);
  };

  return (
    <>
      <button
        className="back"
        type="button"
        aria-label="Back to all bugs"
        onClick={() => setSelected(null)}
      >
        <ArrowLeft size={16} />
        Back to All Bugs
      </button>
      <div className="detailHead">
        <div>
          <div>
            <span className="bugId">{bug.id}</span>
            <Status>{bug.status}</Status>
          </div>
          <h2>{bug.title}</h2>
          <p>
            Reported by {bug.reporter} on {formatIST(bug.createdAt)} IST
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="outline"
            onClick={() => setEditing((value) => !value)}
          >
            <Pencil size={17} />
            {editing ? "Cancel Edit" : "Edit Defect"}
          </button>
          <button className="outline" onClick={exportBugPDF}>
            <Download size={17} />
            Export PDF
          </button>
        </div>
      </div>
      <div className="detailGrid">
        <div>
          <article className="panel contentCard">
            {editing ? (
              <form onSubmit={handleSaveEdit}>
                <label>
                  Defect name *<b></b>
                  <input
                    value={editForm.title}
                    onChange={(e) =>
                      updateEditField("title", e.target.value)
                    }
                    required
                  />
                </label>
                <label>
                  Steps to reproduce *<b></b>
                  <textarea
                    value={editForm.desc}
                    required
                    onChange={(e) =>
                      updateEditField("desc", e.target.value)
                    }
                  />
                </label>
                <label>
                  Priority
                  <select
                    value={editForm.priority}
                    onChange={(e) =>
                      updateEditField("priority", e.target.value)
                    }
                  >
                    {Object.keys(PRIORITY_LABELS).map((priority) => (
                      <option key={priority} value={priority}>
                        {PRIORITY_LABELS[priority]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reproduction Rate
                  <select
                    value={editForm.reproductionRate}
                    onChange={(e) =>
                      updateEditField("reproductionRate", e.target.value)
                    }
                  >
                    <option value="">Select reproduction rate</option>
                    {reproductionRateOptions.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Severity
                  <select
                    value={editForm.severity}
                    onChange={(e) =>
                      updateEditField("severity", e.target.value)
                    }
                  >
                    {SEVERITY_LABELS.map((severity) => (
                      <option key={severity} value={severity}>
                        {severity}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="twoCol">
                  <label>
                    Module / Feature
                    <input
                      value={editForm.moduleFeatureName}
                      onChange={(e) =>
                        updateEditField("moduleFeatureName", e.target.value)
                      }
                    />
                  </label>
                  <fieldset className="editRadioField">
                    <legend>Environment</legend>
                    <div className="radioGroup">
                      {environmentOptions.map((environment) => (
                        <label key={environment}>
                          <input
                            type="radio"
                            name="editEnvironment"
                            value={environment}
                            checked={editForm.environment === environment}
                            onChange={(e) =>
                              updateEditField("environment", e.target.value)
                            }
                          />
                          {environment}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
                <div className="twoCol">
                  <label>
                    Build / App Version
                    <input
                      value={editForm.buildAppVersion}
                      onChange={(e) =>
                        updateEditField("buildAppVersion", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Release Version
                    <input
                      value={editForm.releaseVersion}
                      onChange={(e) =>
                        updateEditField("releaseVersion", e.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="twoCol">
                  <fieldset className="editRadioField">
                    <legend>Defect Type</legend>
                    <div className="editDefectTypeRadioGroup">
                      <div className="editDefectTypeRow">
                        {defectTypeOptions.slice(0, 6).map((type) => (
                          <label key={type}>
                            <input
                              type="radio"
                              name="editDefectType"
                              value={type}
                              checked={editForm.defectType === type}
                              onChange={(e) =>
                                updateEditField("defectType", e.target.value)
                              }
                            />
                            {type}
                          </label>
                        ))}
                      </div>
                      <div className="editDefectTypeRow">
                        {defectTypeOptions.slice(6).map((type) => (
                          <label key={type}>
                            <input
                              type="radio"
                              name="editDefectType"
                              value={type}
                              checked={editForm.defectType === type}
                              onChange={(e) =>
                                updateEditField("defectType", e.target.value)
                              }
                            />
                            {type}
                          </label>
                        ))}
                      </div>
                    </div>
                    {editForm.defectType === "Other" && (
                      <input
                        className="otherDefectTypeInput"
                        value={otherDefectType}
                        onChange={(e) => setOtherDefectType(e.target.value)}
                        placeholder="Enter the defect type"
                        aria-label="Other defect type"
                      />
                    )}
                  </fieldset>
                </div>
                <div className="twoCol">
                  <label>
                    Expected result
                    <textarea
                      value={editForm.expectedResult}
                      onChange={(e) =>
                        updateEditField("expectedResult", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Actual result
                    <textarea
                      value={editForm.actualResult}
                      onChange={(e) =>
                        updateEditField("actualResult", e.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="twoCol">
                  <fieldset className="editRadioField">
                    <legend>Type of Application</legend>
                    <div className="radioGroup">
                      {["Web Application", "Mobile App", "Mobile Browser"].map(
                        (type) => (
                          <label key={type}>
                            <input
                              type="radio"
                              name="editTypeOfApplication"
                              value={type}
                              checked={editForm.typeOfApplication === type}
                              onChange={(e) =>
                                updateEditField("typeOfApplication", e.target.value)
                              }
                            />
                            {type}
                          </label>
                        ),
                      )}
                    </div>
                  </fieldset>
                  <label>
                    Browser
                    <input
                      value={editForm.browser}
                      onChange={(e) =>
                        updateEditField("browser", e.target.value)
                      }
                    />
                  </label>
                </div>
                <label>
                  Browser Version
                  <input
                    value={editForm.browserVersion}
                    onChange={(e) =>
                      updateEditField("browserVersion", e.target.value)
                    }
                  />
                </label>
                <label>
                  Add attachments
                  <input
                    type="file"
                    accept="image/*,video/*,.pdf,.txt"
                    multiple
                    onChange={(e) => {
                      const selectedFiles = Array.from(e.target.files || []);
                      const validFiles = selectedFiles.filter(
                        (file) => file.size <= 50 * 1024 * 1024,
                      );
                      setAttachmentsToUpload((existing) => [
                        ...existing,
                        ...validFiles,
                      ]);
                      setAttachmentUploadError(
                        validFiles.length < selectedFiles.length
                          ? "Each attachment must be 50 MB or smaller."
                          : "",
                      );
                      e.target.value = "";
                    }}
                  />
                  <small>New attachments are added without replacing existing files.</small>
                  {attachmentUploadError && (
                    <small className="attachmentUploadError" role="alert">
                      {attachmentUploadError}
                    </small>
                  )}
                </label>
                <button className="primary" type="submit" disabled={busy}>
                  {busy ? "Saving..." : "Save Defect"}
                </button>
              </form>
            ) : (
              <>
                <h3>Steps to reproduce</h3>
                <p>{bug.desc}</p>
              </>
            )}
            {!editing && (
              <div className="detailReportFields">
                {[
                  ["Module / Feature", bug.moduleFeatureName],
                  ["Environment", bug.environment],
                  ["Build / App Version", bug.buildAppVersion],
                  ["Release Version", bug.releaseVersion],
                  ["Defect Type", bug.defectType],
                  ["Reproduction Rate", bug.reproductionRate],
                  ["Type of Application", bug.typeOfApplication],
                  [
                    "Browser",
                    [bug.browser, bug.browserVersion].filter(Boolean).join(" "),
                  ],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label}>
                      <h3>{label}</h3>
                      <p>{value}</p>
                    </div>
                  ))}
              </div>
            )}
            {!editing && (bug.expectedResult || bug.actualResult) && (
              <div className="twoCol">
                {bug.expectedResult && (
                  <div>
                    <h3>Expected result</h3>
                    <p>{bug.expectedResult}</p>
                  </div>
                )}
                {bug.actualResult && (
                  <div>
                    <h3>Actual result</h3>
                    <p>{bug.actualResult}</p>
                  </div>
                )}
              </div>
            )}
            <div className="attachmentList">
              {(bug.attachments || []).map((savedAttachment) => {
              const downloadUrl =
                savedAttachment.url ||
                (savedAttachment.id === "legacy-screenshot"
                  ? `${API}/tickets/${bug.rawId}/screenshot`
                  : null);
              const type = savedAttachment.contentType || "";
              const AttachmentTypeIcon = type.startsWith("image/")
                ? FileImage
                : type.startsWith("video/")
                  ? FileVideo
                  : type.includes("pdf") || type.startsWith("text/")
                    ? FileText
                    : FileIcon;

              return (
                <div
                  className="attachment"
                  key={savedAttachment.id}
                >
                  <AttachmentTypeIcon className="attachmentFileIcon" size={21} />
                  <span>
                    <b title={savedAttachment.fileName}>{savedAttachment.fileName}</b>
                    <small>
                      {type.split("/").pop()?.toUpperCase() || "FILE"}
                    </small>
                  </span>
                  <div className="attachmentActions">
                    {downloadUrl && (
                      <button
                        className="iconBtn"
                        type="button"
                        title="Download attachment"
                        aria-label={`Download ${savedAttachment.fileName}`}
                        onClick={() => window.open(downloadUrl, "_blank")}
                      >
                        <Download size={17} />
                      </button>
                    )}
                  </div>
                </div>
              );
              })}
              {attachmentsToUpload.map((file, index) => {
              const AttachmentTypeIcon = file.type.startsWith("image/")
                ? FileImage
                : file.type.startsWith("video/")
                  ? FileVideo
                  : file.type.includes("pdf") || file.type.startsWith("text/")
                    ? FileText
                    : FileIcon;
              return (
                <div className="attachment attachmentPendingUpload" key={`${file.name}-${file.lastModified}-${index}`}>
                  <AttachmentTypeIcon className="attachmentFileIcon" size={21} />
                  <span>
                    <b title={file.name}>{file.name}</b>
                    <small>Will be added when changes are saved</small>
                  </span>
                </div>
              );
              })}
            </div>
          </article>
          <article className="panel comments">
            <h3>History and Comments</h3>
            <div className="timeline">
              {timeline.map((t, i) => (
                <div key={i}>
                  <Avatar text={initialsOf(t.actorName)} small />
                  <p>
                    <b>{t.actorName}</b>{" "}
                    {t.kind === "comment" ? (
                      <>commented: {t.message}</>
                    ) : (
                      t.message
                    )}
                    <small>{formatIST(t.createdAt)} IST</small>
                  </p>
                </div>
              ))}
              {timeline.length === 0 && (
                <p className="muted">No history or comments yet.</p>
              )}
            </div>
            <div className="commentBox">
              <Avatar text={initialsOf(user?.name)} />
              <textarea
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button onClick={handleSend} disabled={busy}>
                <Send size={17} />
              </button>
            </div>
          </article>
        </div>
        <aside className="panel detailsSide">
          <h3>Details</h3>
          <label>
            Status
            <select
              value={next}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={busy}
            >
              {STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Severity
            <span className={"severity " + severityClass(bug.severity)}>
              {bug.severity}
            </span>
          </label>
          <label>
            Priority
            <span
              className={
                "severity " +
                severityClass(
                  bug.priority ||
                    SEVERITY_TO_PRIORITY[bug.severity] ||
                    "medium",
                )
              }
            >
              {priorityLabel(
                bug.priority || SEVERITY_TO_PRIORITY[bug.severity] || "medium",
              )}
            </span>
          </label>
          <label>
            Assignee
            <span className="person">
              <Avatar
                text={
                  bug.assignee === "Unassigned"
                    ? "?"
                    : initialsOf(bug.assignee.split(",")[0])
                }
                small
              />
              {bug.assignee}
            </span>
            {canReassign && (
              <button
                type="button"
                className="link"
                style={{ marginTop: 6 }}
                onClick={() => setReassignOpen((o) => !o)}
              >
                Reassign...
              </button>
            )}
            {reassignOpen && (
              <select
                autoFocus
                multiple
                defaultValue={bug.assigneeIds || []}
                onChange={(e) =>
                  handleReassign(
                    Array.from(e.target.selectedOptions, (opt) => opt.value),
                  )
                }
                disabled={busy}
                style={{ minHeight: "110px" }}
              >
                {users
                  .filter(
                    (u) =>
                      u.role === "admin" ||
                      u.role === "developer" ||
                      u.role === "tester",
                  )
                  .map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} -{" "}
                      {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </option>
                  ))}
              </select>
            )}
          </label>
          <label>
            Reporter
            <span className="person">
              <Avatar text={initialsOf(bug.reporter)} small />
              {bug.reporter}
            </span>
          </label>
          <label>
            Project<b>{bug.project}</b>
          </label>
          <label>
            Reported
            <span>
              <CalendarDays size={15} /> {formatIST(bug.createdAt)} IST
            </span>
          </label>
          <label>
            Last Updated
            <span>
              <CalendarDays size={15} /> {formatIST(bug.updatedAt)} IST
            </span>
          </label>
          <hr />
          <h3>Fix Description</h3>
          <textarea
            placeholder="Add details about the fix..."
            value={fixDescription}
            onChange={(e) => setFixDescription(e.target.value)}
          />
          <button
            className="primary full"
            onClick={handleSaveFix}
            disabled={savingFix}
          >
            {savingFix ? "Saving..." : savedFix ? "Saved" : "Save Changes"}
          </button>
        </aside>
      </div>
    </>
  );
}

export default Detail;
