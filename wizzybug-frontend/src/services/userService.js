import { apiFetch } from "../config/api";

export const listUsers = () => apiFetch("/users?includePending=true");

export const updateCurrentUser = (profile) =>
	apiFetch("/users/me", {
		method: "PATCH",
		body: JSON.stringify(profile),
	});
