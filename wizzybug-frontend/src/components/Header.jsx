import React, { useMemo, useState, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
const {LayoutDashboard,Bug,Plus,Users,User,Settings,LogOut,Search,Bell,ChevronDown,ArrowUpRight,Clock3,CircleCheck,TriangleAlert,Filter,Download,Menu,X,ChevronRight,Paperclip,Send,CalendarDays,BarChart3,FolderKanban,Activity,ShieldCheck,Eye,EyeOff,Moon,Sun,UserCog,Mail,ClipboardList,RefreshCcw,FolderPlus,ArrowLeft} = Icons;
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API, apiFetch, setToken } from '../config/api';
import { formatIST, formatISTLong, timeAgoIST, IST_TZ } from '../utils/date';
import { STATUS_LABELS, STATUS_VALUES, PRIORITY_LABELS, SEVERITY_TO_PRIORITY } from '../utils/constants';
import { Avatar, Logo, RoleBadge, Status } from '../components/Ui';
import { initialsOf, isAssignedToUser, priorityLabel, statusLabel, buildTimeline } from '../utils/formatters';

function Header({
  title,
  onMenu,
  setPage,
  globalSearch,
  setGlobalSearch,
  theme,
  toggleTheme,
  bugs = [],
  projects = [],
  user,
  setSelected,
  openProject,
}) {
  const userId = user?._id
    ? String(user._id)
    : user?.email?.toLowerCase() || "anonymous";
  const notificationStorageKey = `wizzybug-read-notifications:${userId}`;
  const [now, setNow] = useState(new Date());
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(notificationStorageKey) || "[]",
      );
      return new Set(Array.isArray(saved) ? saved : []);
    } catch {
      return new Set();
    }
  });
  const notificationWrapRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(notificationStorageKey) || "[]",
      );
      setReadNotificationIds(new Set(Array.isArray(saved) ? saved : []));
    } catch {
      setReadNotificationIds(new Set());
    }
  }, [notificationStorageKey]);

  useEffect(() => {
    if (!notificationsOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!notificationWrapRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [notificationsOpen]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const userEmail = user?.email?.toLowerCase() || "";
  const projectNotifications = projects
    .filter((project) =>
      (project.members || []).some((member) => {
        const memberId = String(member?._id || member || "");
        const memberEmail = member?.email?.toLowerCase() || "";
        return (
          (userId && memberId === userId) ||
          (userEmail && memberEmail === userEmail)
        );
      }),
    )
    .map((project) => {
      const updatedAt = project.updatedAt || project.createdAt;
      return {
        type: "project",
        id: `project-${project._id}-${updatedAt || ""}`,
        projectId: String(project._id),
        title: project.name,
        context: "Project assigned to you",
        updatedAt,
      };
    });
  const bugNotifications = bugs
    .filter((bug) => isAssignedToUser(bug, user))
    .map((bug) => {
      const updatedAt = bug.updatedAt || bug.createdAt;
      return {
        type: "bug",
        id: `bug-${bug.rawId || bug.id}-${updatedAt || ""}`,
        bug,
        title: bug.title,
        context: "Bug assigned to you",
        project: bug.project,
        updatedAt,
      };
    });
  const notifications = [...bugNotifications, ...projectNotifications]
    .sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .filter((notification) => !readNotificationIds.has(notification.id))
    .slice(0, 8);

  const markNotificationRead = (notificationId) => {
    setReadNotificationIds((current) => {
      const updated = new Set(current);
      updated.add(notificationId);
      try {
        localStorage.setItem(
          notificationStorageKey,
          JSON.stringify([...updated]),
        );
      } catch {}
      return updated;
    });
  };

  return (
    <header>
      <button className="mobileMenu" onClick={onMenu}>
        <Menu />
      </button>
      <div>
        <h1>{title}</h1>
        <p>
          {formatISTLong(now)} -{" "}
          {now.toLocaleTimeString("en-IN", {
            timeZone: IST_TZ,
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          IST
        </p>
      </div>
      <div className="headerActions">
        <label className="globalSearch">
          <Search size={17} />
          <input
            placeholder="Search Anything..."
            value={globalSearch}
            onChange={(e) => {
              setGlobalSearch(e.target.value);
              if (e.target.value.trim() !== "") {
                setPage("bugs");
              }
            }}
          />
        </label>
        <div className="notificationWrap" ref={notificationWrapRef}>
          <button
            className="iconBtn notificationButton"
            type="button"
            aria-label={`${notificationsOpen ? "Close" : "Open"} notifications (${notifications.length})`}
            aria-expanded={notificationsOpen}
            onClick={(event) => {
              event.stopPropagation();
              setNotificationsOpen((open) => !open);
            }}
          >
            <Bell size={19} />
            {notifications.length > 0 && (
              <span className="notificationBadge">{notifications.length}</span>
            )}
          </button>
          {notificationsOpen && (
            <div className="notificationMenu" role="dialog" aria-label="Notifications">
              <div className="notificationHead">
                <strong>Notifications</strong>
                <span>{notifications.length}</span>
              </div>
              {notifications.length ? (
                <div className="notificationList">
                  {notifications.map((notification) => (
                    <button
                      className={`notificationCard ${user?.role || "member"}`}
                      key={notification.id}
                      type="button"
                      onClick={() => {
                        markNotificationRead(notification.id);
                        setNotificationsOpen(false);
                        if (notification.type === "bug") {
                          setSelected(notification.bug);
                        } else {
                          openProject(notification.projectId);
                        }
                      }}
                    >
                      <span className="notificationIcon">
                        {notification.type === "bug" ? (
                          <Bug size={16} />
                        ) : (
                          <FolderKanban size={16} />
                        )}
                      </span>
                      <span className="notificationText">
                        <b>{notification.context}</b>
                        <span>{notification.title}</span>
                        <small>
                          {notification.project
                            ? `${notification.project} · `
                            : ""}
                          {timeAgoIST(notification.updatedAt)}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="notificationEmpty">
                  No bug or project assignments yet.
                </p>
              )}
            </div>
          )}
        </div>
        <button
          className="iconBtn themeToggle themeToggleNav"
          onClick={toggleTheme}
          title={
            theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"
          }
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          <span className="themeToggleLabel">
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </span>
        </button>
        <button className="primary" onClick={() => setPage("report")}>
          <Plus size={18} />
          Report Bug
        </button>
      </div>
    </header>
  );
}

export default Header;

