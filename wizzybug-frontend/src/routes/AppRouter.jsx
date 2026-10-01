import { Routes, Route } from "react-router-dom";
import AcceptInvite from "../pages/AcceptInvite";
import ResetPassword from "../pages/ResetPassword";
import VerifyEmail from "../pages/VerifyEmail";

export default function AppRouter({ App }) {
  return (
    <Routes>
      <Route path="/admin/*" element={<App isAdminPage={true} />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/*" element={<App isAdminPage={false} />} />
    </Routes>
  );
}
