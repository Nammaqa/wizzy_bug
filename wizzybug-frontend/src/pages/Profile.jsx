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
import {
  initialsOf,
  isAssignedToUser,
  priorityLabel,
  statusLabel,
  buildTimeline,
} from "../utils/formatters";
import { updateCurrentUser } from "../services/userService";

function Profile({ user, setUser, bugs = [], refreshTickets }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const bugsReported = bugs.filter(
    (b) =>
      (user?._id && String(b.reporterId) === String(user._id)) ||
      (!b.reporterId && b.reporter === user?.name),
  ).length;
  const bugsResolved = bugs.filter(
    (b) =>
      ((user?._id && (b.assigneeIds || []).some((id) => String(id) === String(user._id))) ||
        (!b.assigneeIds?.length && b.assignee === user?.name)) &&
      (b.status === "resolved" || b.status === "closed"),
  ).length;
  const bugsAssigned = bugs.filter(
    (b) =>
      (user?._id && (b.assigneeIds || []).some((id) => String(id) === String(user._id))) ||
      (!b.assigneeIds?.length && b.assignee === user?.name),
  ).length;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const firstName = e.target.firstName.value;
    const lastName = e.target.lastName.value;
    const email = e.target.email.value;
    const namePattern = /^[A-Za-z]+$/;

    if (!namePattern.test(firstName) || !namePattern.test(lastName)) {
      e.target.firstName.reportValidity();
      e.target.lastName.reportValidity();
      setSaving(false);
      return;
    }

    const updatedName = `${firstName} ${lastName}`.trim();

    try {
      const updatedUser = await updateCurrentUser({ name: updatedName, email });
      setUser?.(updatedUser);
      await refreshTickets?.();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      alert(error.message || "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  const firstName = user?.name ? user.name.split(" ")[0] : "";
  const lastName = user?.name ? user.name.split(" ").slice(1).join(" ") : "";

  return (
    <>
      <div className="pageIntro">
        <div>
          <h2>My Profile</h2>
          <p>Manage your personal information and account security.</p>
        </div>
      </div>
      <div className="profileGrid">
        <article className="panel profileCard">
          <div className="bigAvatar">{initialsOf(user?.name)}</div>
          <RoleBadge role={user?.role} />
          <hr />
          <div>
            <span>
              Bugs reported<b>{bugsReported}</b>
            </span>
            <span>
              Bugs assigned<b>{bugsAssigned}</b>
            </span>
            <span>
              Bugs resolved<b>{bugsResolved}</b>
            </span>
          </div>
        </article>
        <form className="panel profileForm" onSubmit={handleSave}>
          <h3>Personal Information</h3>
          <p>Update your name and contact information.</p>
          <div className="twoCol">
            <label>
              First name
              <input
                name="firstName"
                defaultValue={firstName}
                pattern="[A-Za-z]+"
                title="Use letters only"
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(
                    /[^A-Za-z]/g,
                    "",
                  );
                }}
                required
                maxLength={40}
              />
            </label>
            <label>
              Last name
              <input
                name="lastName"
                defaultValue={lastName}
                pattern="[A-Za-z]+"
                title="Use letters only"
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(
                    /[^A-Za-z]/g,
                    "",
                  );
                }}
                required
                maxLength={40}
              />
            </label>
          </div>
          <label>
            Email address
            <input
              name="email"
              type="email"
              defaultValue={user?.email || ""}
              required
              maxLength={254}
            />
          </label>
          <label>
            Role
            <input
              value={
                user?.role
                  ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
                  : "Developer"
              }
              disabled
            />
          </label>
          <div className="formActions">
            <button className="primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// Admin-only: assign or reassign every bug in the workspace to a developer.
// This is the dedicated page requested for bug-assignment workflows.

export default Profile;
