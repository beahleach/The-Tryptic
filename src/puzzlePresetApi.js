export async function fetchPuzzlePresets() {
  const response = await fetch("http://localhost:8787/api/puzzle-presets");
  if (!response.ok) {
    throw new Error(`Failed to fetch puzzle presets: ${response.status}`);
  }
  return response.json();
}

export async function savePuzzlePresets(presets) {
  const response = await fetch("http://localhost:8787/api/puzzle-presets", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(presets),
  });

  if (!response.ok) {
    throw new Error(`Failed to save puzzle presets: ${response.status}`);
  }

  return response.json();
}
