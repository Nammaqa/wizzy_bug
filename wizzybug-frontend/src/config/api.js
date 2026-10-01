const API = import.meta.env.VITE_API_URL;

export { API };

export const getToken = () => localStorage.getItem("token") || "";

export const setToken = (token) => {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
};

export const clearStoredAuth = () => {
  setToken(null);
  localStorage.removeItem("user");
  localStorage.setItem("isLogged", "false");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth:expired"));
  }
};

export async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = isFormData
    ? { ...(options.headers || {}) }
    : {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API + path, { ...options, headers });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* no body */
  }

  if (!res.ok) {
    const message = (data && data.message) || `Request failed (${res.status})`;
    if (
      res.status === 401 &&
      typeof window !== "undefined" &&
      !path.startsWith("/auth/")
    ) {
      clearStoredAuth();
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return data;
}
