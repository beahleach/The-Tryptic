import { readFile, writeFile } from "node:fs/promises";

function getArgValue(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function getPresetSlotNumber(slotId) {
  const match = /^triangle-(\d+)$/.exec(String(slotId || ""));
  return match ? match[1] : "?";
}

function getPresetFileName(entry) {
  if (entry?.fileName && String(entry.fileName).trim()) return String(entry.fileName).trim();
  return "Untitled Puzzle.try";
}

async function readEntries(filePath, fallback) {
  if (!filePath) return fallback;
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function buildAlerts(previousEntries, nextEntries) {
  const alerts = [];
  const slotIds = new Set([...Object.keys(previousEntries), ...Object.keys(nextEntries)]);

  for (const slotId of slotIds) {
    const previous = previousEntries[slotId] || null;
    const next = nextEntries[slotId] || null;
    if (!next) continue;

    const changed =
      !previous ||
      previous.fileName !== next.fileName ||
      previous.name !== next.name ||
      JSON.stringify(previous.puzzle || null) !== JSON.stringify(next.puzzle || null);

    if (!changed) continue;

    const slotNumber = getPresetSlotNumber(slotId);
    const fileName = getPresetFileName(next);
    alerts.push({
      subject: `[PRESET ${slotNumber} UPDATED] ${fileName}`,
      body: `Preset ${slotNumber} was updated to ${fileName}.`,
    });
  }

  return alerts;
}

async function main() {
  const previousEntries = await readEntries(getArgValue("previous"), {});
  const nextEntries = await readEntries(getArgValue("current"), {});
  const alerts = buildAlerts(previousEntries, nextEntries);
  const outputPath = getArgValue("output");

  if (outputPath) {
    await writeFile(outputPath, JSON.stringify({ alerts }, null, 2), "utf8");
  }

  if (!alerts.length) {
    console.log("No preset change notifications to send.");
    return;
  }

  for (const alert of alerts) {
    console.log(`${alert.subject}\n${alert.body}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
