import { apiFetch } from "../config/api";

export const listBugs = () => apiFetch("/tickets");
export const updateBugStatus = (id, status) =>
  apiFetch(`/tickets/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
export const addBugComment = (id, text) =>
  apiFetch(`/tickets/${id}/comments`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
