import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
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
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import "./styles/styles.css";
import {
  API,
  apiFetch,
  clearStoredAuth,
  getToken,
  setToken,
} from "./config/api";
import {
  PRIORITY_LABELS,
  SEVERITY_TO_PRIORITY,
  STATUS_LABELS,
  STATUS_VALUES,
} from "./utils/constants";
import { IST_TZ, formatIST, formatISTLong, timeAgoIST } from "./utils/date";
import { Avatar, Logo, RoleBadge, Status } from "./components/Ui";
import { formatBug } from "./utils/formatters";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import AssignBugsPage from "./pages/AssignBugsPage";
import BugsPage from "./pages/BugsPage";
import Dashboard from "./pages/Dashboard";
import Detail from "./pages/Detail";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import ReportPage from "./pages/ReportPage";
import UsersPage from "./pages/UsersPage";

const initialBugs = [];
const initialUsers = [];

function parseAppRoute(pathname, isAdminPage) {
  const appPath = isAdminPage ? pathname.replace(/^\/admin/, "") : pathname;
  const segments = appPath.split("/").filter(Boolean);

  if (segments[0] === "projects" && segments[1]) {
    return { page: "projects", projectId: segments[1], bugId: null };
  }
  if (segments[0] === "bugs" && segments[1]) {
    return { page: "bugs", projectId: null, bugId: segments[1] };
  }

  const validPages = [
    "dashboard",
    "bugs",
    "report",
    "users",
    "profile",
    "assign",
    "projects",
  ];
  const page = validPages.includes(segments[0]) ? segments[0] : "dashboard";
  return { page, projectId: null, bugId: null };
}

function App({ isAdminPage = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const initialRoute = parseAppRoute(location.pathname, isAdminPage);
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("theme") || "light";
  });
  const [logged, setLogged] = useState(() => {
    if (typeof window === "undefined") return false;
    const storedIsLogged = localStorage.getItem("isLogged");
    if (storedIsLogged === "true") return true;
    return Boolean(getToken());
  });
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });
  const [globalSearch, setGlobalSearch] = useState("");
  const [page, setPage] = useState(initialRoute.page);
  const [bugs, setBugs] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(initialRoute.bugId);
  const [selectedProjectId, setSelectedProjectId] = useState(
    initialRoute.projectId,
  );
  const [projectFilter, setProjectFilter] = useState(null);
  const [menu, setMenu] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const titles = {
    dashboard: "Dashboard",
    bugs: "Bug Management",
    report: "Report a Bug",
    users: "User Management",
    profile: "My Profile",
    assign: "Assign Bugs",
    projects: "Projects",
  };
  const selected = selectedId
    ? bugs.find((b) => b.rawId === selectedId) || null
    : null;
  const selectedProject = selectedProjectId
    ? projects.find(
        (project) => String(project._id) === String(selectedProjectId),
      ) || null
    : null;
  const appPath = (path) => `${isAdminPage ? "/admin" : ""}${path}`;
  const pagePath = (nextPage) => appPath(`/${nextPage}`);
  const navigatePage = (nextPage) => {
    setPage(nextPage);
    setSelectedId(null);
    if (nextPage !== "report") setSelectedProjectId(null);
    navigate(pagePath(nextPage));
  };
  const setSelected = (bug) => {
    setSelectedId(bug ? bug.rawId : null);
    navigate(bug ? appPath(`/bugs/${bug.rawId}`) : pagePath(page));
  };
  const openProject = (projectId) => {
    setSelectedId(null);
    setProjectFilter(null);
    setSelectedProjectId(projectId);
    setPage("projects");
    navigate(appPath(`/projects/${projectId}`));
  };

  useEffect(() => {
    const route = parseAppRoute(location.pathname, isAdminPage);
    setPage(route.page);
    setSelectedId(route.bugId);
    setSelectedProjectId(route.projectId);
  }, [isAdminPage, location.pathname]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("isLogged", logged);
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [logged, user]);

  useEffect(() => {
    const handleAuthExpired = () => {
      setLogged(false);
      setUser(null);
      setBugs([]);
      setUsers([]);
      setProjects([]);
      setPage("dashboard");
    };

    window.addEventListener("auth:expired", handleAuthExpired);
    return () => window.removeEventListener("auth:expired", handleAuthExpired);
  }, []);

  const refreshTickets = () =>
    apiFetch("/tickets")
      .then((data) => {
        if (Array.isArray(data)) setBugs(data.map(formatBug));
      })
      .catch((err) => console.error("Error fetching tickets:", err));

  const refreshUsers = () =>
    apiFetch("/users?includePending=true")
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch((err) => console.error("Error fetching users:", err));

  const refreshProjects = () =>
    apiFetch("/projects")
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
      })
      .catch((err) => console.error("Error fetching projects:", err));

  useEffect(() => {
    if (!logged) return;
    setLoadingData(true);
    Promise.all([refreshTickets(), refreshUsers(), refreshProjects()]).finally(
      () => setLoadingData(false),
    );
  }, [logged]);

  useEffect(() => {
    if (!logged) return undefined;

    let refreshInProgress = false;
    const refreshWorkspaceData = () => {
      if (document.visibilityState !== "visible" || refreshInProgress) return;
      refreshInProgress = true;
      Promise.all([
        refreshTickets(),
        refreshUsers(),
        refreshProjects(),
      ]).finally(() => {
        refreshInProgress = false;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshWorkspaceData();
    };
    const intervalId = window.setInterval(refreshWorkspaceData, 5000);
    window.addEventListener("focus", refreshWorkspaceData);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWorkspaceData);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [logged]);

  if (!logged)
    return (
      <Login
        onLogin={(u, token) => {
          setToken(token);
          setUser(u);
          setLogged(true);
        }}
        isAdminPage={isAdminPage}
        theme={theme}
        toggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
    );

  const normalizePriority = (priority) => {
    const value = String(priority || "")
      .trim()
      .toLowerCase();
    if (["critical", "high", "medium", "low"].includes(value)) return value;
    if (value.startsWith("p1")) return "critical";
    if (value.startsWith("p2")) return "high";
    if (value.startsWith("p3")) return "medium";
    if (value.startsWith("p4")) return "low";
    return SEVERITY_TO_PRIORITY[priority] || "medium";
  };

  const addBug = async (b) => {
    const mappedPriority = normalizePriority(
      b.priority || SEVERITY_TO_PRIORITY[b.severity] || "medium",
    );
    const formData = new FormData();
    formData.append("title", b.title);
    formData.append("description", b.desc);
    formData.append("severity", b.severity || "Minor");
    formData.append("priority", mappedPriority);
    formData.append("project", b.project);
    if (b.assignee) formData.append("assignee", b.assignee);
    if (b.assignees) {
      if (Array.isArray(b.assignees)) {
        b.assignees.forEach((assignee) =>
          formData.append("assignees", assignee),
        );
      } else {
        formData.append("assignees", b.assignees);
      }
    }
    if (b.file) {
      formData.append("image", b.file);
    }
    formData.append("environment", b.environment || "");
    formData.append("moduleFeatureName", b.moduleFeatureName || "");
    formData.append("buildAppVersion", b.buildAppVersion || "");
    formData.append("releaseVersion", b.releaseVersion || "");
    formData.append("reproductionRate", b.reproductionRate || "");
    formData.append("expectedResult", b.expectedResult || "");
    formData.append("actualResult", b.actualResult || "");
    formData.append("defectType", b.defectType || "");
    formData.append("typeOfApplication", b.typeOfApplication || "");
    formData.append("browser", b.browser || "");
    formData.append("browserVersion", b.browserVersion || "");

    const data = await apiFetch("/tickets", {
      method: "POST",
      body: formData,
    });
    setBugs((x) => [formatBug(data), ...x]);
    if (b.assignee) refreshUsers();
  };

  const updateStatus = async (rawId, status) => {
    const data = await apiFetch(`/tickets/${rawId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    setBugs((x) => x.map((b) => (b.rawId === rawId ? formatBug(data) : b)));
  };

  const updateBug = async (rawId, values) => {
    const formData = new FormData();
    formData.append("title", values.title || "");
    formData.append("description", values.desc || "");
    formData.append("severity", values.severity || "Minor");
    formData.append("priority", normalizePriority(values.priority || "medium"));
    formData.append("environment", values.environment || "");
    formData.append("moduleFeatureName", values.moduleFeatureName || "");
    formData.append("buildAppVersion", values.buildAppVersion || "");
    formData.append("releaseVersion", values.releaseVersion || "");
    formData.append("reproductionRate", values.reproductionRate || "");
    formData.append("expectedResult", values.expectedResult || "");
    formData.append("actualResult", values.actualResult || "");
    formData.append("defectType", values.defectType || "");
    formData.append("typeOfApplication", values.typeOfApplication || "");
    formData.append("browser", values.browser || "");
    formData.append("browserVersion", values.browserVersion || "");
    values.attachmentsToUpload?.forEach((file) =>
      formData.append("images", file),
    );

    const data = await apiFetch(`/tickets/${rawId}`, {
      method: "PUT",
      body: formData,
    });
    const updatedBug = formatBug(data);
    setBugs((x) =>
      x.map((b) =>
        b.rawId === rawId
          ? {
              ...b,
              ...updatedBug,
              severity: values.severity || updatedBug.severity,
              priority: values.priority || updatedBug.priority,
              reproductionRate:
                values.reproductionRate || updatedBug.reproductionRate,
            }
          : b,
      ),
    );
  };

  const addComment = async (rawId, text) => {
    const data = await apiFetch(`/tickets/${rawId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    setBugs((x) => x.map((b) => (b.rawId === rawId ? formatBug(data) : b)));
  };

  const saveFixNotes = async (rawId, fixDescription) => {
    const data = await apiFetch(`/tickets/${rawId}/fix-notes`, {
      method: "PUT",
      body: JSON.stringify({ fixDescription }),
    });
    setBugs((x) => x.map((b) => (b.rawId === rawId ? formatBug(data) : b)));
  };

  const assignBug = async (rawId, userIds) => {
    const payload = Array.isArray(userIds)
      ? { assignees: userIds }
      : { assignee: userIds };
    const data = await apiFetch(`/tickets/${rawId}/assign`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    setBugs((x) => x.map((b) => (b.rawId === rawId ? formatBug(data) : b)));
  };

  const createProject = async (payload) => {
    const data = await apiFetch("/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setProjects((x) => [data, ...x]);
  };

  const deleteProject = async (projectId) => {
    await apiFetch(`/projects/${projectId}`, { method: "DELETE" });
    setProjects((current) =>
      current.filter((project) => String(project._id) !== String(projectId)),
    );
    setBugs((current) =>
      current.filter((bug) => String(bug.projectId) !== String(projectId)),
    );
    setProjectFilter((current) =>
      String(current) === String(projectId) ? null : current,
    );
    setSelectedProjectId((current) =>
      String(current) === String(projectId) ? null : current,
    );
  };

  const isAdmin = user?.role === "admin";
  let content;
  if (selected) {
    content = (
      <Detail
        key={selected.rawId}
        bug={selected}
        setSelected={setSelected}
        updateStatus={updateStatus}
        addComment={addComment}
        updateBug={updateBug}
        saveFixNotes={saveFixNotes}
        assignBug={assignBug}
        users={users}
        user={user}
      />
    );
  } else if (selectedProject && page !== "report") {
    content = (
      <ProjectDetailPage
        project={selectedProject}
        bugs={bugs}
        users={users}
        onBack={() => setSelectedProjectId(null)}
        setSelected={setSelected}
      />
    );
  } else if (page === "dashboard") {
    content = (
      <Dashboard
        bugs={bugs}
        setSelected={setSelected}
        setPage={navigatePage}
        user={user}
      />
    );
  } else if (page === "bugs") {
    content = (
      <BugsPage
        bugs={bugs}
        setSelected={setSelected}
        user={user}
        globalSearch={globalSearch}
        setGlobalSearch={setGlobalSearch}
        projects={projects}
        projectFilter={projectFilter}
        setProjectFilter={setProjectFilter}
      />
    );
  } else if (page === "report") {
    content = (
      <ReportPage
        addBug={addBug}
        setPage={navigatePage}
        projects={projects}
        users={users}
        user={user}
        selectedProjectId={selectedProjectId}
      />
    );
  } else if (page === "assign" && isAdmin) {
    content = (
      <AssignBugsPage
        bugs={bugs}
        users={users}
        assignBug={assignBug}
        setSelected={setSelected}
      />
    );
  } else if (page === "users" && isAdmin) {
    content = (
      <UsersPage
        users={users}
        bugs={bugs}
        currentUser={user}
        refreshUsers={refreshUsers}
      />
    );
  } else if (page === "projects") {
    content = (
      <ProjectsPage
        projects={projects}
        bugs={bugs}
        user={user}
        createProject={createProject}
        deleteProject={deleteProject}
        openProject={openProject}
        setPage={navigatePage}
        setProjectFilter={setProjectFilter}
      />
    );
  } else {
    content = (
      <Profile
        user={user}
        setUser={setUser}
        bugs={bugs}
        refreshTickets={refreshTickets}
      />
    );
  }

  return (
    <div className="app">
      <Sidebar
        page={page}
        setPage={navigatePage}
        open={menu}
        setOpen={setMenu}
        onLogout={() => {
          setToken(null);
          setLogged(false);
          setUser(null);
          setBugs([]);
          setUsers([]);
          setProjects([]);
        }}
        user={user}
        bugs={bugs}
        projects={projects}
        projectFilter={projectFilter}
        setProjectFilter={setProjectFilter}
        selectedProjectId={selectedProjectId}
        onProjectClick={openProject}
        theme={theme}
        toggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />
      <main>
        <Header
          title={selected ? "Bug details" : titles[page]}
          onMenu={() => setMenu(true)}
          setPage={navigatePage}
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
          theme={theme}
          toggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          bugs={bugs}
          projects={projects}
          user={user}
          setSelected={setSelected}
          openProject={openProject}
        />
        <div className="content">
          {loadingData && bugs.length === 0 ? (
            <div className="muted" style={{ padding: 40, textAlign: "center" }}>
              Loading your workspace...
            </div>
          ) : (
            content
          )}
        </div>
      </main>
      {menu && <div className="overlay" onClick={() => setMenu(false)} />}
    </div>
  );
}

export default App;
