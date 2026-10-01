import { apiFetch } from "../config/api";

export const listProjects = () => apiFetch("/projects");
export const createProject = (details) =>
  apiFetch("/projects", { method: "POST", body: JSON.stringify(details) });
