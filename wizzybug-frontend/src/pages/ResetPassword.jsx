import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { apiFetch } from "../config/api";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState("");
  const token = new URLSearchParams(window.location.search).get("token");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setStatus("Error: Passwords do not match");
      return;
    }
    setStatus("Resetting...");
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setStatus("Password reset successfully. Redirecting to sign in...");
      setTimeout(() => (window.location.href = "/"), 1500);
    } catch (error) {
      setStatus("Error: " + (error.message || "Could not reset password"));
    }
  };

  return (
    <div className="loginPage passwordPageLight">
      <div className="loginBox passwordBoxLight">
        <h2>Reset Password</h2>
        <p>Choose a new password for your WizzyBug account.</p>
        {status && (
          <p style={{ color: status.startsWith("Error") ? "red" : "green" }}>
            {status}
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <label>
            New Password
            <div className="password">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                maxLength={40}
                autoComplete="new-password"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <label>
            Confirm Password
            <div className="password">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={6}
                maxLength={40}
                autoComplete="new-password"
              />
              <button
                type="button"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                onClick={() => setShowConfirmPassword((visible) => !visible)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <button
            className="primary"
            type="submit"
            disabled={!token || status === "Resetting..."}
          >
            Reset Password
          </button>
        </form>
      </div>
    </div>
  );
}
