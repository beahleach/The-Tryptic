import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./loadEnv.js";

loadLocalEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);
const DATA_DIR = path.join(__dirname, "data");
const PREFS_PATH = path.join(DATA_DIR, "preferences.json");
const DEBUT_MONITOR_STATE_PATH = path.join(DATA_DIR, "triangle-debut-monitor.json");
const PUZZLE_PRESETS_PATH = path.join(__dirname, "..", "src", "puzzlePresets.json");
const TRIANGLE_DEBUTS_PATH = path.join(__dirname, "..", "src", "triangleDebuts.json");
const PUBLISH_GAME_CONFIG_SCRIPT = path.join(__dirname, "..", "scripts", "publish-triangle-debuts.mjs");
const PORT = Number(process.env.PORT || 8787);
const MONITOR_POLL_MS = Number(process.env.TRYPTIC_MONITOR_POLL_MS || 30000);

const defaultPreferences = {
  default: {
    skipHintConfirm: false,
    skipRevealConfirm: false,
  },
};

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
  });
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

function getActiveDebutStateKey(entry) {
  if (!entry?.id) return "";
  return `${entry.id}:${entry.startsAt || ""}:${entry.endsAt || ""}`;
}

async function ensureDebutMonitorStateFile() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(DEBUT_MONITOR_STATE_PATH, "utf8");
  } catch {
    await writeFile(
      DEBUT_MONITOR_STATE_PATH,
      `${JSON.stringify({ lastActiveDebutKey: "" }, null, 2)}\n`
    );
  }
}

async function readDebutMonitorState() {
  await ensureDebutMonitorStateFile();
  try {
    const raw = await readFile(DEBUT_MONITOR_STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? { lastActiveDebutKey: typeof parsed.lastActiveDebutKey === "string" ? parsed.lastActiveDebutKey : "" }
      : { lastActiveDebutKey: "" };
  } catch {
    return { lastActiveDebutKey: "" };
  }
}

async function writeDebutMonitorState(state) {
  await ensureDebutMonitorStateFile();
  await writeFile(
    DEBUT_MONITOR_STATE_PATH,
    `${JSON.stringify({ lastActiveDebutKey: state?.lastActiveDebutKey || "" }, null, 2)}\n`
  );
}

function buildDebutChangeMessages(previousEntries, nextEntries, publish) {
  const previousById = new Map(previousEntries.map((entry) => [entry.id, entry]));
  const nextById = new Map(nextEntries.map((entry) => [entry.id, entry]));
  const messages = [];

  for (const entry of nextEntries) {
    const previous = previousById.get(entry.id);
    const label = getDebutDisplayName(entry);
    const publishSuffix =
      publish?.ok === false ? ` Publish to main still needs attention: ${publish.message}` : "";

    if (!previous) {
      messages.push(
        `Tryptic: Scheduled ${label} to debut ${formatDebutDateTime(entry.startsAt)} through ${formatDebutDateTime(entry.endsAt)}.${publishSuffix}`
      );
      continue;
    }

    if (
      previous.startsAt !== entry.startsAt ||
      previous.endsAt !== entry.endsAt ||
      previous.fileName !== entry.fileName ||
      previous.name !== entry.name
    ) {
      messages.push(
        `Tryptic: Updated debut ${label}. It now runs ${formatDebutDateTime(entry.startsAt)} through ${formatDebutDateTime(entry.endsAt)}.${publishSuffix}`
      );
    }
  }

  for (const entry of previousEntries) {
    if (nextById.has(entry.id)) continue;
    const label = getDebutDisplayName(entry);
    const publishSuffix =
      publish?.ok === false ? ` Publish to main still needs attention: ${publish.message}` : "";
    messages.push(`Tryptic: Deleted debut ${label}.${publishSuffix}`);
  }

  return messages;
}

async function syncLiveDebutNotifications(entries) {
  const [state, currentEntries] = await Promise.all([
    readDebutMonitorState(),
    Array.isArray(entries) ? Promise.resolve(entries) : readTriangleDebuts(),
  ]);
  const activeDebut = getActiveTriangleDebut(currentEntries);
  const nextKey = getActiveDebutStateKey(activeDebut);

  if (state.lastActiveDebutKey === nextKey) {
    return [];
  }

  await writeDebutMonitorState({ lastActiveDebutKey: nextKey });

  if (!activeDebut) {
    return [];
  }

  return [];
}

async function ensurePreferencesFile() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(PREFS_PATH, "utf8");
  } catch {
    await writeFile(PREFS_PATH, JSON.stringify(defaultPreferences, null, 2));
  }
}

async function ensureTriangleDebutsFile() {
  try {
    await readFile(TRIANGLE_DEBUTS_PATH, "utf8");
  } catch {
    await writeFile(TRIANGLE_DEBUTS_PATH, "[]\n");
  }
}

async function ensurePuzzlePresetsFile() {
  try {
    await readFile(PUZZLE_PRESETS_PATH, "utf8");
  } catch {
    await writeFile(PUZZLE_PRESETS_PATH, "{}\n");
  }
}

async function readPreferences() {
  await ensurePreferencesFile();
  try {
    const raw = await readFile(PREFS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { ...defaultPreferences, ...parsed };
  } catch {
    return defaultPreferences;
  }
}

async function writePreferences(preferences) {
  await ensurePreferencesFile();
  await writeFile(PREFS_PATH, JSON.stringify(preferences, null, 2));
}

async function readPuzzlePresets() {
  await ensurePuzzlePresetsFile();
  try {
    const raw = await readFile(PUZZLE_PRESETS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writePuzzlePresets(entries) {
  await ensurePuzzlePresetsFile();
  const nextEntries = entries && typeof entries === "object" && !Array.isArray(entries) ? entries : {};
  await writeFile(PUZZLE_PRESETS_PATH, `${JSON.stringify(nextEntries, null, 2)}\n`);
}

async function readTriangleDebuts() {
  await ensureTriangleDebutsFile();
  try {
    const raw = await readFile(TRIANGLE_DEBUTS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeTriangleDebuts(entries) {
  await ensureTriangleDebutsFile();
  await writeFile(TRIANGLE_DEBUTS_PATH, `${JSON.stringify(Array.isArray(entries) ? entries : [], null, 2)}\n`);
}

async function publishGameConfigToGitHub() {
  const { stdout } = await execFileAsync(process.execPath, [PUBLISH_GAME_CONFIG_SCRIPT], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
  });
  return stdout.trim();
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function getUserId(url) {
  const match = url.pathname.match(/^\/api\/preferences\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: "Missing URL" });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (url.pathname === "/api/triangle-debuts") {
    if (request.method === "GET") {
      const debuts = await readTriangleDebuts();
      sendJson(response, 200, debuts);
      return;
    }

    if (request.method === "PUT") {
      try {
        const incoming = await readJsonBody(request);
        if (!Array.isArray(incoming)) {
          sendJson(response, 400, { error: "Triangle debuts payload must be an array" });
          return;
        }

        const previousEntries = await readTriangleDebuts();
        await writeTriangleDebuts(incoming);
        let publish = { ok: true, message: "Triangle debut schedule published to GitHub main." };

        try {
          const message = await publishGameConfigToGitHub();
          publish = {
            ok: true,
            message: message || publish.message,
          };
        } catch (error) {
          publish = {
            ok: false,
            message: error instanceof Error ? error.message : "Triangle debut schedule save succeeded, but publish failed.",
          };
        }

        const notifications = buildDebutChangeMessages(previousEntries, incoming, publish);
        await syncLiveDebutNotifications(incoming);

        sendJson(response, 200, {
          entries: incoming,
          publish,
          notifications,
        });
      } catch (error) {
        sendJson(response, 500, { error: error instanceof Error ? error.message : "Bad request" });
      }
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  if (url.pathname === "/api/puzzle-presets") {
    if (request.method === "GET") {
      const presets = await readPuzzlePresets();
      sendJson(response, 200, presets);
      return;
    }

    if (request.method === "PUT") {
      try {
        const incoming = await readJsonBody(request);
        if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
          sendJson(response, 400, { error: "Puzzle presets payload must be an object" });
          return;
        }

        await writePuzzlePresets(incoming);
        let publish = { ok: true, message: "Puzzle preset config published to GitHub main." };

        try {
          const message = await publishGameConfigToGitHub();
          publish = {
            ok: true,
            message: message || publish.message,
          };
        } catch (error) {
          publish = {
            ok: false,
            message: error instanceof Error ? error.message : "Puzzle preset save succeeded, but publish failed.",
          };
        }

        sendJson(response, 200, {
          entries: incoming,
          publish,
        });
      } catch (error) {
        sendJson(response, 500, { error: error instanceof Error ? error.message : "Bad request" });
      }
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const userId = getUserId(url);

  if (!userId) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  if (request.method === "GET") {
    const preferences = await readPreferences();
    sendJson(response, 200, preferences[userId] || defaultPreferences.default);
    return;
  }

  if (request.method === "PUT") {
    try {
      const incoming = await readJsonBody(request);
      const preferences = await readPreferences();
      preferences[userId] = {
        ...(preferences[userId] || defaultPreferences.default),
        ...(typeof incoming === "object" && incoming ? incoming : {}),
      };
      await writePreferences(preferences);
      sendJson(response, 200, preferences[userId]);
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : "Bad request" });
    }
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
});

server.listen(PORT, () => {
  console.log(`Tryptic backend listening on http://localhost:${PORT}`);
  console.log("Always-on debut notifications are handled by GitHub Actions email alerts.");
  syncLiveDebutNotifications().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
  });
  setInterval(() => {
    syncLiveDebutNotifications().catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
    });
  }, MONITOR_POLL_MS);
});
