import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { apiFetch, setToken } from "../config/api";

export default function AcceptInvite() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const passwordChecks = {
    length: password.length >= 6 && password.length <= 40,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const passwordValid = Object.values(passwordChecks).every(Boolean);
  const token = new URLSearchParams(window.location.search).get("token");

  const handleAccept = async (event) => {
    event.preventDefault();
    if (!passwordValid) return;
    setStatus("Accepting...");
    try {
      const data = await apiFetch("/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setToken(data.token);
      localStorage.setItem(
        "user",
        JSON.stringify({
          _id: data._id,
          name: data.name,
          email: data.email,
          role: data.role,
        }),
      );
      localStorage.setItem("isLogged", "true");
      setStatus("Success! Redirecting...");
      setTimeout(() => (window.location.href = "/"), 1500);
    } catch (error) {
      setStatus("Error: " + (error.message || "Server error"));
    }
  };

  return (
    <div className="loginPage passwordPageLight">
      <div className="loginBox passwordBoxLight">
        <h2>Accept Invitation</h2>
        <p>Welcome to WizzyBug! Set a password to activate your account.</p>
        {status && (
          <p style={{ color: status.startsWith("Err") ? "red" : "green" }}>
            {status}
          </p>
        )}
        <form onSubmit={handleAccept}>
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
          <ul className="passwordRequirements" aria-live="polite">
            <li className={passwordChecks.length ? "met" : ""}>
              6-40 characters
            </li>
            <li className={passwordChecks.uppercase ? "met" : ""}>
              At least one uppercase letter
            </li>
            <li className={passwordChecks.lowercase ? "met" : ""}>
              At least one lowercase letter
            </li>
            <li className={passwordChecks.number ? "met" : ""}>
              At least one number
            </li>
            <li className={passwordChecks.special ? "met" : ""}>
              At least one special character
            </li>
          </ul>
          <button
            className="primary"
            type="submit"
            disabled={!token || !passwordValid || status === "Accepting..."}
          >
            Accept & Join
          </button>
        </form>
      </div>
    </div>
  );
}
