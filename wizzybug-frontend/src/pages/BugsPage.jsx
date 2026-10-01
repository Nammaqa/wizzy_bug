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
import BugTable from "../components/BugTable";
import {
  initialsOf,
  isAssignedToUser,
  priorityLabel,
  statusLabel,
  buildTimeline,
} from "../utils/formatters";

function BugsPage({
  bugs,
  setSelected,
  user,
  globalSearch,
  setGlobalSearch,
  projects = [],
  projectFilter,
  setProjectFilter,
}) {
  const [status, setStatus] = useState("All");
  const [tab, setTab] = useState("All");

  const scoped = projectFilter
    ? bugs.filter((b) => b.projectId === projectFilter)
    : bugs;

  const filteredBugs = scoped.filter((b) => {
    if (tab === "Assigned to me" && !isAssignedToUser(b, user)) return false;
    if (tab === "Unassigned" && b.assignee !== "Unassigned") return false;
    return true;
  });

  const rows = filteredBugs.filter(
    (b) =>
      (b.title + b.id).toLowerCase().includes(globalSearch.toLowerCase()) &&
      (status === "All" || b.status === status),
  );
  const activeProject = projects.find((p) => p._id === projectFilter);

  return (
    <>
      <div className="pageIntro">
        <div>
          <h2>{activeProject ? activeProject.name : "All Bugs"}</h2>
          <p>
            {activeProject
              ? `Bugs scoped to ${activeProject.name}.`
              : "Track, prioritize, and resolve issues across every project."}
          </p>
        </div>
        {(activeProject || status !== "All") && (
          <div className="pageIntroActions">
            {status !== "All" && (
              <button className="outline" onClick={() => setStatus("All")}>
                <X size={15} />
                Clear Status Filter
              </button>
            )}
            {activeProject && (
              <button className="outline" onClick={() => setProjectFilter(null)}>
                <X size={15} />
                Clear Project Filter
              </button>
            )}
          </div>
        )}
      </div>
      <div className="tabs">
        <button
          className={tab === "All" ? "active" : ""}
          onClick={() => setTab("All")}
        >
          All <span>{scoped.length}</span>
        </button>
        <button
          className={tab === "Assigned to me" ? "active" : ""}
          onClick={() => setTab("Assigned to me")}
        >
          Assigned to me{" "}
          <span>{scoped.filter((b) => isAssignedToUser(b, user)).length}</span>
        </button>
        <button
          className={tab === "Unassigned" ? "active" : ""}
          onClick={() => setTab("Unassigned")}
        >
          Unassigned{" "}
          <span>
            {scoped.filter((b) => b.assignee === "Unassigned").length}
          </span>
        </button>
      </div>
      <article className="panel bugList">
        <div className="tableTools">
          <label>
            <Search size={17} />
            <input
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search by title or bug ID..."
            />
          </label>
          <div>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="All">All Statuses</option>
              {STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            {projects.length > 0 && (
              <select
                value={projectFilter || ""}
                onChange={(e) => setProjectFilter(e.target.value || null)}
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <BugTable bugs={rows} setSelected={setSelected} />
        <div className="pagination">
          <span>
            Showing 1-{rows.length} of {scoped.length} bugs
          </span>
        </div>
      </article>
    </>
  );
}

export default BugsPage;
