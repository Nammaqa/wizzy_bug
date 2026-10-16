import React, { useMemo, useState, useEffect, useRef } from "react";
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

const isValidGmail = (value) => {
  const [localPart, domain] = value.split("@");
  return (
    value.length <= 254 &&
    domain === "gmail.com" &&
    localPart.length <= 64 &&
    !localPart.includes("..") &&
    /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?$/.test(localPart)
  );
};
const isStrongPassword = (value) =>
  value.length >= 6 &&
  value.length <= 40 &&
  /[a-z]/.test(value) &&
  /[A-Z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value);
const normalizeUserName = (value) => value.trim().replace(/\s+/g, " ");
const isValidUserName = (value) =>
  value.length >= 2 &&
  value.length <= 40 &&
  /^[A-Za-z]+(?: [A-Za-z]+)*$/.test(value);

function Login({ onLogin, isAdminPage, theme, toggleTheme }) {
  const verificationResult = new URLSearchParams(window.location.search).get(
    "email-verification",
  );
  const rememberedCredentials = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("rememberedCredentials") || "null",
      );
    } catch {
      return null;
    }
  })();
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRegister, setIsRegister] = useState(verificationResult !== null);
  const [email, setEmail] = useState(rememberedCredentials?.email || "");
  const [password, setPassword] = useState(
    rememberedCredentials?.password || "",
  );
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(Boolean(rememberedCredentials));
  const [error, setError] = useState(
    verificationResult === "error"
      ? "This verification link is invalid or has expired."
      : "",
  );
  const [status, setStatus] = useState(
    verificationResult === "success"
      ? "Email verified successfully. You can now log in."
      : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const submitLock = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    const normalizedEmail = email.trim().toLowerCase();
    const registrationName = isRegister
      ? normalizeUserName(e.target.name.value)
      : "";
    setEmail(normalizedEmail);
    if (!isValidGmail(normalizedEmail)) {
      setError("Enter a valid @gmail.com email address.");
      return;
    }

    if (isRegister) {
      if (!isValidUserName(registrationName)) {
        setError("Name must be 2 to 40 characters and contain letters only.");
        return;
      }
      if (!isStrongPassword(password)) {
        setError(
          "Password must be at least 6 characters and include uppercase, lowercase, a number, and a special character.",
        );
        return;
      }
      if (password !== confirmPassword) {
        setError("Confirm password must match password.");
        return;
      }
    }

    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);

    try {
      let data;
      if (isRegister) {
        const role = e.target.role.value;
        data = await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            name: registrationName,
            email: normalizedEmail,
            password,
            confirmPassword,
            role,
          }),
        });
        setStatus(
          data.message || "Account created successfully. Please sign in.",
        );
        setIsRegister(false);
        setPassword("");
        setConfirmPassword("");
      } else {
        data = await apiFetch("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: normalizedEmail, password }),
        });
        if (rememberMe) {
          localStorage.setItem(
            "rememberedCredentials",
            JSON.stringify({ email: normalizedEmail, password }),
          );
        } else {
          localStorage.removeItem("rememberedCredentials");
        }
        onLogin(
          {
            _id: data._id,
            name: data.name,
            email: data.email,
            role: data.role || "developer",
          },
          data.token,
        );
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = document.querySelector('input[name="email"]')?.value.trim();
    if (!email) {
      setError("Enter your email address first.");
      return;
    }
    setError("");
    setStatus("");
    setForgotSubmitting(true);
    try {
      const data = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setStatus(
        data.message || "If an account exists, a reset link has been sent.",
      );
    } catch (err) {
      setError(err.message || "Could not send the reset email.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="auth">
      <div className="authLeft">
        <Logo />
        <div className="authCopy">
          <span className="eyebrow">BUILT FOR HIGH-PERFORMING TEAMS</span>
          <h1>
            Ship better software,
            <br />
            <em>one bug at a time.</em>
          </h1>
          <p>
            Everything your team needs to report, track, and resolve issues
            without losing momentum.
          </p>
        </div>
        <small className="copyright">
          (c) 2026 WizzyBug. Built for teams who care.
        </small>
      </div>
      <div className="authRight">
        <button
          type="button"
          className="iconBtn themeToggle authThemeToggle"
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="mobileLogo">
            <Logo />
          </div>
          <h2>
            {isRegister
              ? isAdminPage
                ? "Create Admin Account"
                : "Create an account"
              : isAdminPage
                ? "Admin Sign In"
                : "Welcome back"}
          </h2>
          <p>
            {isRegister
              ? "Sign up to get started - choose your role below."
              : isAdminPage
                ? "Enter your details to access the admin dashboard."
                : "Enter your details to access your workspace."}
          </p>

          {error && <div className="formError">{error}</div>}
          {status && <div className="formSuccess">{status}</div>}

          {isRegister && (
            <label>
              Full Name
              <input
                name="name"
                type="text"
                placeholder="Enter your name"
                required
                minLength={2}
                maxLength={40}
                pattern="[A-Za-z]+( [A-Za-z]+)*"
                title="Use letters only; spaces are allowed between names."
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.replace(
                    /[^A-Za-z ]/g,
                    "",
                  );
                }}
                autoComplete="off"
              />
            </label>
          )}
          <label>
            Email address
            <input
              name="email"
              type="text"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              required
              maxLength={254}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <div className="password">
              <input
                name="password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                maxLength={40}
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={6}
              />
              <button type="button" onClick={() => setShow(!show)}>
                {show ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          {isRegister && (
            <label>
              Confirm Password
              <div className="password">
                <input
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your password"
                  required
                  minLength={6}
                  maxLength={40}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={
                    showConfirm
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  onClick={() => setShowConfirm((visible) => !visible)}
                >
                  {showConfirm ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </label>
          )}
          {isRegister && (
            <label>
              My Role
              <select name="role" defaultValue="" required>
                <option value="" disabled>
                  Select role
                </option>
                <option value="admin">Admin</option>
                <option value="developer">Developer</option>
                <option value="tester">Tester</option>
              </select>
            </label>
          )}
          {!isRegister && (
            <div className="remember">
              <label>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setRememberMe(checked);
                    if (!checked)
                      localStorage.removeItem("rememberedCredentials");
                  }}
                />{" "}
                Remember me
              </label>
              <button
                type="button"
                className="forgotPassword"
                onClick={handleForgotPassword}
                disabled={forgotSubmitting}
              >
                {forgotSubmitting ? "Sending..." : "Forgot password?"}
              </button>
            </div>
          )}
          <button className="primary loginBtn" disabled={submitting}>
            {submitting ? "Please wait..." : isRegister ? "Sign up" : "Sign in"}{" "}
            <ArrowUpRight />
          </button>
          <p
            className="signup"
            onClick={() => {
              setIsRegister(!isRegister);
              setConfirmPassword("");
              setError("");
              setStatus("");
            }}
            style={{ cursor: "pointer" }}
          >
            {isRegister ? (
              <>
                Already have an account? <b>Sign in</b>
              </>
            ) : (
              <>
                New to WizzyBug? <b>Create an account</b>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}

export default Login;
//.
