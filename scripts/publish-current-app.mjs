import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "../server/loadEnv.js";

const execFileAsync = promisify(execFile);

loadLocalEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, "..");
const TARGET_BRANCH = process.env.TRYPTIC_PUBLISH_BRANCH || "main";

async function run(command, args, { allowFailure = false } = {}) {
  try {
    return await execFileAsync(command, args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
    });
  } catch (error) {
    if (allowFailure) return error;
    throw error;
  }
}

async function main() {
  await run("npm", ["run", "build"]);
  await run("git", ["add", "-A"]);

  const { stdout: status } = await run("git", ["status", "--porcelain"]);
  if (status.trim()) {
    const timestamp = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
    await run("git", ["commit", "-m", `Deploy current app setup (${timestamp})`]);
  }

  await run("git", ["push", "origin", `HEAD:${TARGET_BRANCH}`]);
  console.log(`Published current app setup to GitHub ${TARGET_BRANCH}. GitHub Pages will deploy automatically.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
