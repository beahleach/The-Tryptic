import { apiFetch } from "./apiClient";

export async function fetchAuthSession() {
  const response = await apiFetch("/api/auth/session");
  if (!response.ok) {
    throw new Error(`Failed to fetch auth session: ${response.status}`);
  }
  return response.json();
}

export async function loginAuthoring(password) {
  const response = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    throw new Error(`Failed to log in: ${response.status}`);
  }

  return response.json();
}

export async function logoutAuthoring() {
  const response = await apiFetch("/api/auth/logout", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to log out: ${response.status}`);
  }

  return response.json();
}
