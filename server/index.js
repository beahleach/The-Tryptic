import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);
const DATA_DIR = path.join(__dirname, "data");
const PREFS_PATH = path.join(DATA_DIR, "preferences.json");
const TRIANGLE_DEBUTS_PATH = path.join(__dirname, "..", "src", "triangleDebuts.json");
const PUBLISH_TRIANGLE_DEBUTS_SCRIPT = path.join(__dirname, "..", "scripts", "publish-triangle-debuts.mjs");
const PORT = Number(process.env.PORT || 8787);

const defaultPreferences = {
  default: {
    skipHintConfirm: false,
    skipRevealConfirm: false,
  },
};

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

async function publishTriangleDebutsToGitHub() {
  const { stdout } = await execFileAsync(process.execPath, [PUBLISH_TRIANGLE_DEBUTS_SCRIPT], {
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

        await writeTriangleDebuts(incoming);
        let publish = { ok: true, message: "Triangle debut schedule published to GitHub main." };

        try {
          const message = await publishTriangleDebutsToGitHub();
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

        sendJson(response, 200, {
          entries: incoming,
          publish,
        });
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : "Bad request" });
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
});
