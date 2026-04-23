const DEFAULT_USER_ID = "default";

export async function fetchPreferences(userId = DEFAULT_USER_ID) {
  const response = await fetch(`/api/preferences/${encodeURIComponent(userId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch preferences: ${response.status}`);
  }
  return response.json();
}

export async function savePreferences(patch, userId = DEFAULT_USER_ID) {
  const response = await fetch(`/api/preferences/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    throw new Error(`Failed to save preferences: ${response.status}`);
  }

  return response.json();
}
