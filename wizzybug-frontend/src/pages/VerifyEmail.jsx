import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../config/api";

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(location.search).get("token");
    if (!token) {
      navigate("/?email-verification=error", { replace: true });
      return;
    }

    apiFetch("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(() => navigate("/?email-verification=success", { replace: true }))
      .catch(() => navigate("/?email-verification=error", { replace: true }));
  }, [location.search, navigate]);

  return (
    <div className="loginPage passwordPageLight">
      <div className="loginBox passwordBoxLight">
        <h2>Verifying your email</h2>
        <p>Please wait while we verify your email address.</p>
      </div>
    </div>
  );
}