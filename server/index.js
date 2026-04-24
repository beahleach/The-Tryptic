import { mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./loadEnv.js";

loadLocalEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const PREFS_PATH = path.join(DATA_DIR, "preferences.json");
const DEBUT_MONITOR_STATE_PATH = path.join(DATA_DIR, "triangle-debut-monitor.json");
const PUZZLE_PRESETS_PATH = path.join(__dirname, "..", "src", "puzzlePresets.json");
const TRIANGLE_DEBUTS_PATH = path.join(__dirname, "..", "src", "triangleDebuts.json");
const PORT = Number(process.env.PORT || 8787);
const MONITOR_POLL_MS = Number(process.env.TRYPTIC_MONITOR_POLL_MS || 30000);
const AUTHORING_PASSWORD = process.env.TRYPTIC_ADMIN_PASSWORD || "";
const SESSION_SECRET = process.env.TRYPTIC_SESSION_SECRET || "local-dev-session-secret";
const SESSION_COOKIE_NAME = "tryptic_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const GITHUB_TOKEN = process.env.TRYPTIC_GITHUB_TOKEN || "";
const GITHUB_REPO = process.env.TRYPTIC_GITHUB_REPO || "beahleach/The-Tryptic";
const GITHUB_BRANCH = process.env.TRYPTIC_GITHUB_BRANCH || "main";
const ALLOWED_ORIGINS = String(process.env.TRYPTIC_ALLOWED_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

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

function isAuthoringAuthRequired() {
  return Boolean(AUTHORING_PASSWORD);
}

function signSessionValue(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function createSessionToken() {
  const expiresAt = String(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  return `${expiresAt}.${signSessionValue(expiresAt)}`;
}

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function validateSessionToken(token) {
  const [expiresAt, signature] = String(token || "").split(".");
  if (!expiresAt || !signature) return false;
  if (Number.isNaN(Number(expiresAt)) || Number(expiresAt) < Date.now()) return false;
  return timingSafeEqualString(signature, signSessionValue(expiresAt));
}

function parseCookies(request) {
  const raw = String(request.headers.cookie || "");
  if (!raw) return {};

  return Object.fromEntries(
    raw
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex < 0) return [part, ""];
        return [part.slice(0, separatorIndex), decodeURIComponent(part.slice(separatorIndex + 1))];
      })
  );
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  parts.push(`Path=${options.path || "/"}`);
  return parts.join("; ");
}

function isCrossSiteAuthoringRequest(request) {
  const origin = String(request.headers.origin || "");
  const host = String(request.headers.host || "");
  if (!origin || !host) return false;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(`http://${host}`);
    return originUrl.hostname !== requestUrl.hostname;
  } catch {
    return false;
  }
}

function isSecureRequest(request) {
  const forwardedProto = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  if (forwardedProto) return forwardedProto === "https";
  const origin = String(request.headers.origin || "");
  return origin.startsWith("https://");
}

function getSessionCookieOptions(request, maxAge) {
  const crossSite = isCrossSiteAuthoringRequest(request);
  return {
    httpOnly: true,
    sameSite: crossSite ? "None" : "Lax",
    secure: crossSite || isSecureRequest(request) || process.env.NODE_ENV === "production",
    maxAge,
  };
}

function getAuthenticatedAuthoringState(request) {
  if (!isAuthoringAuthRequired()) {
    return { authenticated: true, authRequired: false };
  }

  const cookies = parseCookies(request);
  return {
    authenticated: validateSessionToken(cookies[SESSION_COOKIE_NAME]),
    authRequired: true,
  };
}

function getAllowedOrigin(request) {
  const origin = String(request.headers.origin || "");
  if (!origin) return "";
  if (!ALLOWED_ORIGINS.length) return origin;
  return ALLOWED_ORIGINS.includes(origin) ? origin : "";
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

function getGitHubApiUrl(apiPath) {
  return `https://api.github.com${apiPath}`;
}

function getGitHubRepoPath() {
  const [owner, repo] = String(GITHUB_REPO || "").split("/");
  if (!owner || !repo) {
    throw new Error("TRYPTIC_GITHUB_REPO must be in owner/repo format.");
  }
  return { owner, repo };
}

function encodeGitHubContentPath(filePath) {
  return String(filePath || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function githubApiFetch(apiPath, init = {}) {
  if (!GITHUB_TOKEN) {
    throw new Error("TRYPTIC_GITHUB_TOKEN is not configured.");
  }

  const response = await fetch(getGitHubApiUrl(apiPath), {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "User-Agent": "The-Tryptic-Authoring-API",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });

  return response;
}

async function fetchGitHubFileMetadata(filePath) {
  const { owner, repo } = getGitHubRepoPath();
  const response = await githubApiFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubContentPath(filePath)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub file metadata for ${filePath}: ${response.status}`);
  }

  return response.json();
}

async function updateGitHubFile(filePath, content, message) {
  const { owner, repo } = getGitHubRepoPath();
  const existing = await fetchGitHubFileMetadata(filePath);
  const response = await githubApiFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubContentPath(filePath)}`,
    {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: GITHUB_BRANCH,
      ...(existing?.sha ? { sha: existing.sha } : {}),
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed to update ${filePath} on GitHub: ${response.status} ${details}`);
  }

  return response.json();
}

async function publishGameConfigToGitHub({ puzzlePresets, triangleDebuts, commitMessage }) {
  if (!GITHUB_TOKEN) {
    throw new Error("TRYPTIC_GITHUB_TOKEN is not configured.");
  }

  const updates = [];

  if (puzzlePresets) {
    updates.push(
      updateGitHubFile(
        "src/puzzlePresets.json",
        `${JSON.stringify(puzzlePresets, null, 2)}\n`,
        commitMessage || "Update puzzle presets"
      )
    );
  }

  if (triangleDebuts) {
    updates.push(
      updateGitHubFile(
        "src/triangleDebuts.json",
        `${JSON.stringify(triangleDebuts, null, 2)}\n`,
        commitMessage || "Update triangle debut schedule"
      )
    );
  }

  await Promise.all(updates);
  return `Published config to GitHub ${GITHUB_BRANCH}.`;
}

function sendJson(response, statusCode, payload, request, extraHeaders = {}) {
  const allowedOrigin = request ? getAllowedOrigin(request) : "";
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
    "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...(allowedOrigin ? { "Access-Control-Allow-Credentials": "true" } : {}),
    Vary: "Origin",
    ...extraHeaders,
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

function sendUnauthorized(response, request) {
  sendJson(response, 401, { error: "Authoring authentication required" }, request);
}

function requireAuthoringAuth(request, response) {
  const authState = getAuthenticatedAuthoringState(request);
  if (authState.authenticated) return true;
  sendUnauthorized(response, request);
  return false;
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: "Missing URL" }, request);
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {}, request);
    return;
  }

  if (url.pathname === "/health") {
    sendJson(response, 200, { ok: true }, request);
    return;
  }

  if (url.pathname === "/api/auth/session") {
    sendJson(response, 200, getAuthenticatedAuthoringState(request), request);
    return;
  }

  if (url.pathname === "/api/auth/login") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" }, request);
      return;
    }

    try {
      if (!isAuthoringAuthRequired()) {
        sendJson(response, 200, { authenticated: true, authRequired: false }, request);
        return;
      }

      const incoming = await readJsonBody(request);
      if (!timingSafeEqualString(incoming?.password || "", AUTHORING_PASSWORD)) {
        sendJson(response, 401, { error: "Invalid password" }, request);
        return;
      }

      sendJson(
        response,
        200,
        { authenticated: true, authRequired: true },
        request,
        {
          "Set-Cookie": serializeCookie(
            SESSION_COOKIE_NAME,
            createSessionToken(),
            getSessionCookieOptions(request, SESSION_MAX_AGE_SECONDS)
          ),
        }
      );
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : "Bad request" }, request);
    }
    return;
  }

  if (url.pathname === "/api/auth/logout") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" }, request);
      return;
    }

    sendJson(
      response,
      200,
      { authenticated: false, authRequired: isAuthoringAuthRequired() },
      request,
      {
        "Set-Cookie": serializeCookie(
          SESSION_COOKIE_NAME,
          "",
          getSessionCookieOptions(request, 0)
        ),
      }
    );
    return;
  }

  if (url.pathname === "/api/triangle-debuts") {
    if (request.method === "GET") {
      if (!requireAuthoringAuth(request, response)) return;
      const debuts = await readTriangleDebuts();
      sendJson(response, 200, debuts, request);
      return;
    }

    if (request.method === "PUT") {
      if (!requireAuthoringAuth(request, response)) return;
      try {
        const incoming = await readJsonBody(request);
        if (!Array.isArray(incoming)) {
          sendJson(response, 400, { error: "Triangle debuts payload must be an array" }, request);
          return;
        }

        const previousEntries = await readTriangleDebuts();
        await writeTriangleDebuts(incoming);
        let publish = { ok: true, message: "Triangle debut schedule published to GitHub main." };

        try {
          const message = await publishGameConfigToGitHub({
            triangleDebuts: incoming,
            commitMessage: "Update triangle debut schedule",
          });
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
        }, request);
      } catch (error) {
        sendJson(response, 500, { error: error instanceof Error ? error.message : "Bad request" }, request);
      }
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" }, request);
    return;
  }

  if (url.pathname === "/api/puzzle-presets") {
    if (request.method === "GET") {
      if (!requireAuthoringAuth(request, response)) return;
      const presets = await readPuzzlePresets();
      sendJson(response, 200, presets, request);
      return;
    }

    if (request.method === "PUT") {
      if (!requireAuthoringAuth(request, response)) return;
      try {
        const incoming = await readJsonBody(request);
        if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
          sendJson(response, 400, { error: "Puzzle presets payload must be an object" }, request);
          return;
        }

        await writePuzzlePresets(incoming);
        let publish = { ok: true, message: "Puzzle preset config published to GitHub main." };

        try {
          const message = await publishGameConfigToGitHub({
            puzzlePresets: incoming,
            commitMessage: "Update puzzle presets",
          });
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
        }, request);
      } catch (error) {
        sendJson(response, 500, { error: error instanceof Error ? error.message : "Bad request" }, request);
      }
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" }, request);
    return;
  }

  const userId = getUserId(url);

  if (!userId) {
    sendJson(response, 404, { error: "Not found" }, request);
    return;
  }

  if (request.method === "GET") {
    const preferences = await readPreferences();
    sendJson(response, 200, preferences[userId] || defaultPreferences.default, request);
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
      sendJson(response, 200, preferences[userId], request);
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : "Bad request" }, request);
    }
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" }, request);
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
