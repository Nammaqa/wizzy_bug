import React, { useMemo, useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
const {LayoutDashboard,Bug,Plus,Users,User,Settings,LogOut,Search,Bell,ChevronDown,ArrowUpRight,Clock3,CircleCheck,TriangleAlert,Filter,Download,Menu,X,ChevronRight,Paperclip,Send,CalendarDays,BarChart3,FolderKanban,Activity,ShieldCheck,Eye,EyeOff,Moon,Sun,UserCog,Mail,ClipboardList,RefreshCcw,FolderPlus,ArrowLeft} = Icons;
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API, apiFetch, setToken } from '../config/api';
import { formatIST, formatISTLong, timeAgoIST, IST_TZ } from '../utils/date';
import { STATUS_LABELS, STATUS_VALUES, PRIORITY_LABELS, SEVERITY_TO_PRIORITY } from '../utils/constants';
import { Avatar, Logo, RoleBadge, Status } from '../components/Ui';
import { initialsOf, isAssignedToUser, priorityLabel, statusLabel, buildTimeline, severityClass } from '../utils/formatters';

function BugTable({ bugs, setSelected, compact = false }) {
  const displayBugs = [...bugs].sort((left, right) => {
    const leftCreatedAt = new Date(left.createdAt || 0).getTime();
    const rightCreatedAt = new Date(right.createdAt || 0).getTime();
    return rightCreatedAt - leftCreatedAt;
  });

  return (
    <div className={compact ? "tableWrap compact" : "tableWrap bugTable"}>
      <table>
        <thead>
          <tr>
            <th>BUG ID</th>
            <th>BUG TITLE</th>
            <th>SEVERITY</th>
            <th>PRIORITY</th>
            <th>STATUS</th>
            <th>ASSIGNEE</th>
            <th>CREATED DATE</th>
          </tr>
        </thead>
        <tbody>
          {displayBugs.map((b) => (
            <tr
              key={b.id}
              onClick={() => setSelected(b)}
              style={{ cursor: "pointer" }}
            >
              <td className="bugIdCell">{b.id}</td>
              <td className="bugTitleCell">
                <b>{b.title}</b>
                <small>
                  {b.project}
                </small>
              </td>
              <td>
                <span className={"severity " + severityClass(b.severity)}>
                  {b.severity}
                </span>
              </td>
              <td>
                <span className={"severity " + severityClass(b.priority)}>
                  {priorityLabel(b.priority)}
                </span>
              </td>
              <td>
                <Status>{b.status}</Status>
              </td>
              <td>
                {b.assignee === "Unassigned" ? (
                  <span className="muted">Unassigned</span>
                ) : (
                  <span className="person">
                    <Avatar text={initialsOf(b.assignee.split(",")[0])} small />
                    {b.assignee}
                  </span>
                )}
              </td>
              <td className="date bugDateCell">{formatIST(b.createdAt)}</td>
            </tr>
          ))}
          {displayBugs.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="muted"
                style={{ textAlign: "center", padding: "30px 0" }}
              >
                No bugs to show.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default BugTable;

