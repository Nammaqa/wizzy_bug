import { Bug } from "lucide-react";
import { STATUS_LABELS } from "../utils/constants";

export function Logo({ onClick }) {
  return (
    <button className="logo" type="button" onClick={onClick} aria-label="Go to dashboard">
      <span className="logoMark">
        <Bug size={20} />
      </span>
      <strong>
        Wizzy<span>Bug</span>
      </strong>
    </button>
  );
}

export function Avatar({ text = "OS", small = false }) {
  return <span className={`avatar ${small ? "small" : ""}`}>{text}</span>;
}

export function Status({ children }) {
  const label = STATUS_LABELS[children] || children;
  const className = String(children || "open")
    .toLowerCase()
    .replaceAll("_", "-");
  return (
    <span className={`status ${className}`}>
      <i />
      {label}
    </span>
  );
}

export function RoleBadge({ role }) {
  const normalizedRole = (role || "developer").toLowerCase();
  const label =
    normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);
  return <span className={`role ${normalizedRole}`}>{label}</span>;
}
