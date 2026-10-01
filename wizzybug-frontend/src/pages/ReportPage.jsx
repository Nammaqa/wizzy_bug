import React, { useMemo, useState } from "react";
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
} = Icons;
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { API, apiFetch, setToken } from "../config/api";
import { formatIST, formatISTLong, timeAgoIST, IST_TZ } from "../utils/date";
import {
  STATUS_LABELS,
  STATUS_VALUES,
  PRIORITY_LABELS,
  SEVERITY_TO_PRIORITY,
} from "../utils/constants";
import { Avatar, Logo, RoleBadge, Status } from "../components/Ui";
import {
  initialsOf,
  isAssignedToUser,
  priorityLabel,
  statusLabel,
  buildTimeline,
} from "../utils/formatters";

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024;

function ReportPage({
  addBug,
  setPage,
  projects = [],
  users = [],
  user,
  selectedProjectId = "",
}) {
  const [form, setForm] = useState({
    technicalMemberName: user?.name || "",
    project: selectedProjectId || "",
    assignee: "",
    assignees: [],
    moduleFeatureName: "",
    environment: "",
    buildAppVersion: "",
    releaseVersion: "",
    defectSummary: "",
    stepsToReproduce: "",
    defectType: "",
    severity: "",
    priority: "",
    reproductionRate: "",
    expectedResult: "",
    actualResult: "",
    otherDefectType: "",
    typeOfApplication: "",
    browser: "Chrome",
    browserVersion: "",
  });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [defectTypeMessage, setDefectTypeMessage] = useState("");
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);

  const compressImageUpload = async (selectedFile) => {
    if (!selectedFile || !selectedFile.type?.startsWith("image/")) {
      return null;
    }

    const reader = new FileReader();
    const dataUrl = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = () =>
        reject(new Error("Could not read the selected image."));
      reader.readAsDataURL(selectedFile);
    });

    const image = new Image();
    const img = await new Promise((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("The selected image could not be loaded."));
      image.src = dataUrl;
    });

    const maxDimension = 1280;
    let width = img.width;
    let height = img.height;

    if (width > height && width > maxDimension) {
      height = (height * maxDimension) / width;
      width = maxDimension;
    } else if (height > maxDimension) {
      width = (width * maxDimension) / height;
      height = maxDimension;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare the image for upload.");

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const mimeType =
      selectedFile.type === "image/png" || selectedFile.type === "image/webp"
        ? "image/jpeg"
        : selectedFile.type;
    const quality = selectedFile.size > 1024 * 1024 ? 0.72 : 0.82;
    const compressedDataUrl = canvas.toDataURL(mimeType, quality);

    return {
      base64: compressedDataUrl.split(",")[1],
      mimeType,
    };
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (e.target.name === "defectType" || e.target.name === "otherDefectType") {
      setDefectTypeMessage("");
    }
  };
  const isAdmin = user?.role === "admin";
  const canAssign = ["admin", "developer", "tester"].includes(
    String(user?.role || "").toLowerCase(),
  );
  const assignableUsers = users.filter((candidate) =>
    ["admin", "developer", "tester"].includes(
      String(candidate.role || "").toLowerCase(),
    ),
  );
  const selectedAssigneeNames = assignableUsers
    .filter((candidate) => form.assignees.includes(candidate._id))
    .map((candidate) => candidate.name);
  const goBack = () => setPage(selectedProjectId ? "projects" : "bugs");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.defectSummary) return;
    if (!form.project) {
      setError("Select a project before submitting.");
      return;
    }
    if (!form.defectType) {
      setDefectTypeMessage(
        "Defect type is mandatory. Please select one option.",
      );
      return;
    }
    if (form.defectType === "Other" && !form.otherDefectType.trim()) {
      setDefectTypeMessage("Please enter the defect type.");
      return;
    }
    if (!file) {
      setError("Please upload an attachment before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      let imageFile = file;
      if (file) {
        const compressed = await compressImageUpload(file);
        if (compressed) {
          const byteCharacters = atob(compressed.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i += 1) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          imageFile = new File([byteArray], file.name, {
            type: compressed.mimeType,
          });
        }
      }

      await addBug({
        title: form.defectSummary,
        desc: form.stepsToReproduce,
        severity: form.severity,
        priority: form.priority,
        project: form.project,
        assignee: form.assignee || undefined,
        assignees: form.assignees.length ? form.assignees : undefined,
        file: imageFile,
        environment: form.environment,
        moduleFeatureName: form.moduleFeatureName,
        buildAppVersion: form.buildAppVersion,
        releaseVersion: form.releaseVersion,
        reproductionRate: form.reproductionRate,
        expectedResult: form.expectedResult,
        actualResult: form.actualResult,
        defectType:
          form.defectType === "Other"
            ? form.otherDefectType.trim()
            : form.defectType,
        typeOfApplication: form.typeOfApplication,
        browser: form.browser,
        browserVersion: form.browserVersion,
      });
      setPage("bugs");
    } catch (err) {
      console.error("Error submitting bug:", err);
      setError(err.message || "Could not submit Bug. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="formPage">
      <button className="back" type="button" onClick={goBack}>
        <ArrowLeft size={16} />
        Back
      </button>
      <div className="pageIntro">
        <div>
          <h2>Report a Bug</h2>
          <p>
            Give your team the context they need to reproduce and resolve the
            issue.
          </p>
        </div>
      </div>
      <form className="panel reportForm" onSubmit={submit}>
        <div className="sectionTitle">
          <span>1</span>
          <div>
            <h3>Issue Details</h3>
            <p>Describe what went wrong and where it happened.</p>
          </div>
        </div>

        {error && <div className="formError">{error}</div>}

        <label>
          Technical Member Name<b>*</b>
          <div
            className="technicalMemberNameInput"
            aria-label="Technical Member Name"
            aria-readonly="true"
          >
            {user?.name || ""}
          </div>
        </label>
        <label>
          Project Name <b>*</b>
          {projects.length === 0 ? (
            <div className="muted" style={{ padding: "10px 0" }}>
              No projects yet -{" "}
              {isAdmin ? (
                <>
                  create one from the{" "}
                  <a
                    onClick={() => setPage("projects")}
                    style={{ cursor: "pointer", color: "var(--purple2)" }}
                  >
                    Projects Page
                  </a>{" "}
                  first.
                </>
              ) : (
                "ask an admin to create one first."
              )}
            </div>
          ) : (
            <select
              name="project"
              value={form.project}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                Select project
              </option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                  {p.key ? ` (${p.key})` : ""}
                </option>
              ))}
            </select>
          )}
        </label>

        {canAssign && (
          <label>
            Assign to (optional)
            <div className="assignDropdown reportAssigneeDropdown">
              <button
                type="button"
                className="assignSelectButton"
                aria-haspopup="listbox"
                aria-expanded={assigneeDropdownOpen}
                onClick={() => setAssigneeDropdownOpen((open) => !open)}
              >
                <span>
                  {selectedAssigneeNames.length
                    ? selectedAssigneeNames.join(", ")
                    : "Select assignees"}
                </span>
                <ChevronDown size={16} />
              </button>
              {assigneeDropdownOpen && (
                <div
                  className="assignOptions"
                  role="listbox"
                  aria-label="Assign to"
                  aria-multiselectable="true"
                >
                  {assignableUsers.map((candidate) => {
                    const selected = form.assignees.includes(candidate._id);
                    return (
                      <button
                        key={candidate._id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className="assignOptionItem"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            assignees: selected
                              ? current.assignees.filter(
                                  (id) => id !== candidate._id,
                                )
                              : [...current.assignees, candidate._id],
                          }))
                        }
                      >
                        <span className="assignOptionLine">
                          <span className="assignOptionName">
                            {candidate.name}
                          </span>
                          <span className="assignOptionRole">
                            <RoleBadge role={candidate.role} />
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {assignableUsers.length === 0 && (
                    <div className="assignOptionName">No assignees available</div>
                  )}
                </div>
              )}
            </div>
          </label>
        )}

        <label>
          Module / Feature Name<b>*</b>
          <input
            name="moduleFeatureName"
            value={form.moduleFeatureName}
            onChange={handleChange}
            maxLength={150}
            placeholder="your Answer"
            required
          />
        </label>

        <label>
          Environment <b>*</b>
        </label>
        <div className="radioGroup">
          {["Development", "QA", "UAT", "Staging", "Production"].map((env) => (
            <label
              key={env}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                margin: 0,
                fontWeight: "normal",
              }}
            >
              <input
                type="radio"
                name="environment"
                value={env}
                checked={form.environment === env}
                onChange={handleChange}
                required
              />{" "}
              {env}
            </label>
          ))}
        </div>
        <br />

        <label>
          Build or App Version (Optional)
          <input
            name="buildAppVersion"
            value={form.buildAppVersion}
            onChange={handleChange}
            placeholder="your Answer"
          />
        </label>

        <label>
          Release Version (Optional)
          <input
            name="releaseVersion"
            value={form.releaseVersion}
            onChange={handleChange}
            placeholder="your Answer"
          />
        </label>

        <label>
          Defect Summary<b>*</b>
          <textarea
            name="defectSummary"
            value={form.defectSummary}
            onChange={handleChange}
            placeholder="Describe the defect"
            required
          />
        </label>

        <label>
          Steps to Reproduce (Write Point Wise with 1 Numbering)<b>*</b>
          <textarea
            name="stepsToReproduce"
            value={form.stepsToReproduce}
            onChange={handleChange}
            placeholder="1. Open the application&#10;2. Navigate to the affected area"
            required
          />
        </label>

        <label>
          Defect Type <b>*</b>
        </label>
        <div className="radioGroup">
          {[
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
          ].map((type) => (
            <label
              key={type}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                margin: 0,
                fontWeight: "normal",
              }}
            >
              <input
                type="radio"
                name="defectType"
                value={type}
                checked={form.defectType === type}
                onChange={handleChange}
                required
              />{" "}
              {type}
            </label>
          ))}
        </div>
        {form.defectType === "Other" && (
          <input
            className="otherDefectTypeInput"
            name="otherDefectType"
            value={form.otherDefectType}
            onChange={handleChange}
            placeholder="Enter the defect type"
            aria-label="Other defect type"
            required
          />
        )}
        {defectTypeMessage && (
          <div className="formError" role="alert">
            {defectTypeMessage}
          </div>
        )}
        <br />

        <div className="twoCol">
          <label>
            Severity <b>*</b>
            <select
              name="severity"
              value={form.severity}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                Select severity
              </option>
              <option>Blocker(System Crash/Data Loss)</option>
              <option>Critical</option>
              <option>Major</option>
              <option>Minor</option>
              <option>Cosmetic</option>
            </select>
          </label>
          <label>
            Priority<b>*</b>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                Select priority
              </option>
              {Object.entries(PRIORITY_LABELS).map(([priorityValue, label]) => (
                <option key={priorityValue} value={priorityValue}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="twoCol">
          <label>
            Reproduction Rate<b>*</b>
            <select
              name="reproductionRate"
              value={form.reproductionRate}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                Select reproduction rate
              </option>
              <option>100%</option>
              <option>75%</option>
              <option>50%</option>
              <option>25%</option>
              <option>Random</option>
            </select>
          </label>
        </div>

        <label>
          Expected Result<b>*</b>
          <textarea
            name="expectedResult"
            value={form.expectedResult}
            onChange={handleChange}
            placeholder="What should happen?"
            required
          />
        </label>
        <label>
          Actual Result<b>*</b>
          <textarea
            name="actualResult"
            value={form.actualResult}
            onChange={handleChange}
            placeholder="What happened instead?"
            required
          />
        </label>

        <div className="sectionTitle second">
          <span>2</span>
          <div>
            <h3>
              Attachments <b>*</b>
            </h3>
            <p>
              Upload a screenshot or file that helps explain the issue.
              Required.
            </p>
          </div>
        </div>
        <label className="drop">
          <Paperclip />
          <strong>
            {file ? (
              file.name
            ) : (
              <>
                Drop files here or <u>browse</u>
              </>
            )}
          </strong>
          <b>*</b>
          <small>PNG, JPG, GIF or MP4 - Max 50MB</small>
          <input
            type="file"
            accept="image/*,video/mp4"
            aria-required="true"
            onChange={(e) => {
              const selectedFile = e.target.files[0] || null;
              if (selectedFile && selectedFile.size > MAX_ATTACHMENT_SIZE) {
                setFile(null);
                setError("Attachment must be 50 MB or smaller.");
                e.target.value = "";
                return;
              }
              setError((currentError) =>
                currentError === "Attachment must be 50 MB or smaller."
                  ? ""
                  : currentError,
              );
              setFile(selectedFile);
            }}
          />
        </label>

        <label>
          Type of Application <b>*</b>
        </label>
        <div className="radioGroup">
          {["Web Application", "Mobile App", "Mobile Browser"].map((type) => (
            <label
              key={type}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                margin: 0,
                fontWeight: "normal",
              }}
            >
              <input
                type="radio"
                name="typeOfApplication"
                value={type}
                checked={form.typeOfApplication === type}
                onChange={handleChange}
                required
              />{" "}
              {type}
            </label>
          ))}
        </div>
        <br />

        <div className="twoCol">
          <label>
            Browser (Configuration Information)<b>*</b>
            <select name="browser" value={form.browser} onChange={handleChange}>
              <option>Chrome</option>
              <option>Firefox</option>
              <option>Safari</option>
              <option>Edge</option>
              <option>Other</option>
            </select>
          </label>
        </div>

        <label>
          Browser Version<b>*</b>
          <input
            name="browserVersion"
            value={form.browserVersion}
            onChange={handleChange}
            placeholder="your Answer"
            required
          />
        </label>

        <div className="formActions">
          <button
            type="button"
            className="outline"
            onClick={goBack}
          >
            Cancel
          </button>
          <button className="primary" disabled={submitting}>
            <Bug size={17} />
            {submitting ? "Submitting..." : "Submit Bug"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Turns backend history + comment entries into one merged, time-sorted feed.

export default ReportPage;
