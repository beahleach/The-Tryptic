export async function fetchTriangleDebuts() {
  const response = await fetch("/api/triangle-debuts");
  if (!response.ok) {
    throw new Error(`Failed to fetch triangle debuts: ${response.status}`);
  }
  return response.json();
}

export async function saveTriangleDebuts(entries) {
  const response = await fetch("/api/triangle-debuts", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(entries),
  });

  if (!response.ok) {
    throw new Error(`Failed to save triangle debuts: ${response.status}`);
  }

  return response.json();
}
