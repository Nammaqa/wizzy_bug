import React, { useMemo, useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
const {LayoutDashboard,Bug,Plus,Users,User,Settings,LogOut,Search,Bell,ChevronDown,ArrowUpRight,Clock3,CircleCheck,TriangleAlert,Filter,Download,Menu,X,ChevronRight,Paperclip,Send,CalendarDays,BarChart3,FolderKanban,Activity,ShieldCheck,Eye,EyeOff,Moon,Sun,UserCog,Mail,ClipboardList,RefreshCcw,FolderPlus,ArrowLeft} = Icons;
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API, apiFetch, setToken } from '../config/api';
import { formatIST, formatISTLong, timeAgoIST, IST_TZ } from '../utils/date';
import { STATUS_LABELS, STATUS_VALUES, PRIORITY_LABELS, SEVERITY_TO_PRIORITY } from '../utils/constants';
import { Avatar, Logo, RoleBadge, Status } from '../components/Ui';
import { initialsOf, isAssignedToUser, isReportedByUser, priorityLabel, statusLabel, buildTimeline } from '../utils/formatters';

function Stats({ admin = true, bugs = [], user }) {
  const total = bugs.length;
  const open = bugs.filter((b) => b.status === "open").length;
  const inProgress = bugs.filter((b) => b.status === "in_progress").length;
  const closed = bugs.filter(
    (b) => b.status === "closed" || b.status === "resolved",
  ).length;

  const thisMonthResolved = bugs.filter((b) => {
    if (b.status !== "resolved" && b.status !== "closed") return false;
    const d = new Date(b.updatedAt || b.createdAt);
    const now = new Date();
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  }).length;

  const data = admin
    ? [
        [
          "Total Bugs",
          total,
          `${
            bugs.filter((b) => {
              const d = new Date(b.createdAt);
              const now = new Date();
              return (
                d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear()
              );
            }).length
          } this month`,
          Bug,
          "purple",
        ],
        ["Open Bugs", open, "needs triage", TriangleAlert, "red"],
        ["In Progress", inProgress, "being worked on", Clock3, "orange"],
        ["Closed", closed, "resolved", CircleCheck, "green"],
      ]
    : [
        [
          "Assigned to me",
          bugs.filter((b) => isAssignedToUser(b, user)).length,
          "total",
          Bug,
          "purple",
        ],
        [
          "In Progress",
          bugs.filter(
            (b) => isAssignedToUser(b, user) && b.status === "in_progress",
          ).length,
          "working",
          Clock3,
          "orange",
        ],
        [
          "Fixed this month",
          bugs.filter(
            (b) =>
              isAssignedToUser(b, user) &&
              (b.status === "resolved" || b.status === "closed"),
          ).length,
          "done",
          CircleCheck,
          "blue",
        ],
        [
          "Reported by Me",
          bugs.filter((b) => isReportedByUser(b, user)).length,
          "submitted",
          Plus,
          "blue",
        ],
        ["Open bugs", open, "across team", Activity, "green"],
      ];

  return (
    <div className="stats">
      {data.map(([label, num, delta, I, color]) => (
        <article key={label}>
          <div className={"statIcon " + color}>
            <I size={20} />
          </div>
          <span>{label}</span>
          <strong>{num}</strong>
          <small>
            <b>
              <ArrowUpRight size={13} />
              {delta}
            </b>
          </small>
        </article>
      ))}
    </div>
  );
}

// 7-day bug intake trend, rendered with the pre-built .chart / .line / .area
// CSS in styles.css (previously unused -- Trend/Distribution were empty stubs).

export default Stats;

