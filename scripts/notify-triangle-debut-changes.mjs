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

function formatDebutTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "??:??";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Chicago",
  });
}

async function readEntries(filePath) {
  if (!filePath) return [];
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildAlerts(previousEntries, nextEntries) {
  const previousById = new Map(previousEntries.map((entry) => [entry.id, entry]));
  const nextById = new Map(nextEntries.map((entry) => [entry.id, entry]));
  const alerts = [];

  for (const entry of nextEntries) {
    const previous = previousById.get(entry.id);
    const fileName = getDebutDisplayName(entry);
    const time = formatDebutTime(entry.startsAt);

    if (!previous) {
      alerts.push({
        subject: `[DEBUT SCHEDULED ${time}] ${fileName}`,
        body: `Scheduled ${fileName} to debut ${formatDebutDateTime(entry.startsAt)} through ${formatDebutDateTime(entry.endsAt)}.`,
      });
      continue;
    }

    if (
      previous.startsAt !== entry.startsAt ||
      previous.endsAt !== entry.endsAt ||
      previous.fileName !== entry.fileName ||
      previous.name !== entry.name
    ) {
      alerts.push({
        subject: `[DEBUT UPDATED ${time}] ${fileName}`,
        body: `Updated ${fileName}. It now runs ${formatDebutDateTime(entry.startsAt)} through ${formatDebutDateTime(entry.endsAt)}.`,
      });
    }
  }

  for (const entry of previousEntries) {
    if (nextById.has(entry.id)) continue;
    alerts.push({
      subject: `[DEBUT DELETED ${formatDebutTime(entry.startsAt)}] ${getDebutDisplayName(entry)}`,
      body: `Deleted ${getDebutDisplayName(entry)} from the debut schedule.`,
    });
  }

  return alerts;
}

async function main() {
  const previousEntries = await readEntries(getArgValue("previous"));
  const nextEntries = await readEntries(getArgValue("current"));
  const alerts = buildAlerts(previousEntries, nextEntries);
  const outputPath = getArgValue("output");

  if (outputPath) {
    await writeFile(outputPath, JSON.stringify({ alerts }, null, 2), "utf8");
  }

  for (const alert of alerts) {
    console.log(`${alert.subject}\n${alert.body}`);
  }

  if (!alerts.length) {
    console.log("No triangle debut change notifications to send.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
