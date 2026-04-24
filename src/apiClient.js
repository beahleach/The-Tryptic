function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/g, "");
}

const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);

export function getApiUrl(path) {
  const normalizedPath = String(path || "").startsWith("/") ? String(path) : `/${String(path || "")}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

export async function apiFetch(path, init = {}) {
  const response = await fetch(getApiUrl(path), {
    credentials: "include",
    ...init,
    headers: {
      ...(init.headers || {}),
    },
  });

  return response;
}
