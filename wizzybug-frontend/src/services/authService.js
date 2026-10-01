import { apiFetch } from "../config/api";

export const login = (credentials) =>
  apiFetch("/auth/login", { method: "POST", body: JSON.stringify(credentials) });

export const register = (details) =>
  apiFetch("/auth/register", { method: "POST", body: JSON.stringify(details) });

export const inviteUser = (details) =>
  apiFetch("/auth/invite", { method: "POST", body: JSON.stringify(details) });

export const acceptInvite = (details) =>
  apiFetch("/auth/accept-invite", {
    method: "POST",
    body: JSON.stringify(details),
  });
