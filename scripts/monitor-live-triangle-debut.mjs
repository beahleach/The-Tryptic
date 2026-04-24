import { readFile, writeFile } from "node:fs/promises";

function getArgValue(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function getDebutDisplayName(entry) {
  if (entry?.fileName && String(entry.fileName).trim()) return String(entry.fileName).trim();
  if (entry?.name && String(entry.name).trim()) return String(entry.name).trim();
  return "Untitled Puzzle";
}

function formatDebutDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "an unknown time";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function getActiveTriangleDebut(entries, now = Date.now()) {
  return [...entries]
    .reverse()
    .find((entry) => {
      const start = new Date(entry?.startsAt || "").getTime();
      const end = new Date(entry?.endsAt || "").getTime();
      return Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end;
    }) || null;
}

function getActiveDebutKey(entry) {
  if (!entry?.id) return "";
  return `${entry.id}:${entry.startsAt || ""}:${entry.endsAt || ""}`;
}

async function main() {
  const debutsPath = getArgValue("debuts");
  const statePath = getArgValue("state");
  const outputPath = getArgValue("output");
  const debuts = await readJson(debutsPath, []);
  const state = await readJson(statePath, { lastActiveDebutKey: "" });
  const activeDebut = getActiveTriangleDebut(Array.isArray(debuts) ? debuts : []);
  const nextKey = getActiveDebutKey(activeDebut);

  if (state.lastActiveDebutKey === nextKey) {
    if (outputPath) {
      await writeFile(outputPath, "", "utf8");
    }
    console.log("No live debut change detected.");
    return;
  }

  const nextState = {
    lastActiveDebutKey: nextKey,
  };

  await writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`);

  if (!activeDebut) {
    if (!state.lastActiveDebutKey) {
      if (outputPath) {
        await writeFile(outputPath, "", "utf8");
      }
      console.log("No live debut is active and no notification was needed.");
      return;
    }

    const message = "Tryptic: No live debut is active. Public players are back on the Triangle 1 preset.";
    if (outputPath) {
      await writeFile(outputPath, message, "utf8");
    }
    console.log(message);
    return;
  }

  const message = `Tryptic: ${getDebutDisplayName(activeDebut)} is now live for public players until ${formatDebutDateTime(activeDebut.endsAt)}.`;
  if (outputPath) {
    await writeFile(outputPath, message, "utf8");
  }
  console.log(message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
