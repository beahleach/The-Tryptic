import { execFile } from "node:child_process";
import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, "..");
const SOURCE_PRESETS_PATH = path.join(REPO_ROOT, "src", "puzzlePresets.json");
const SOURCE_DEBUTS_PATH = path.join(REPO_ROOT, "src", "triangleDebuts.json");
const REMOTE_REPO = "git@github.com:beahleach/The-Tryptic.git";

async function runGit(args, { cwd } = {}) {
  return execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
  });
}

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "tryptic-triangle-debuts-"));
  const cloneDir = path.join(tempRoot, "repo");

  try {
    await runGit(["clone", "--depth", "1", REMOTE_REPO, cloneDir]);
    await cp(SOURCE_PRESETS_PATH, path.join(cloneDir, "src", "puzzlePresets.json"));
    await cp(SOURCE_DEBUTS_PATH, path.join(cloneDir, "src", "triangleDebuts.json"));

    const { stdout: status } = await runGit(
      ["status", "--porcelain", "--", "src/puzzlePresets.json", "src/triangleDebuts.json"],
      {
        cwd: cloneDir,
      }
    );

    if (!status.trim()) {
      console.log("Puzzle presets and triangle debut schedule already match GitHub main.");
      return;
    }

    await runGit(["add", "src/puzzlePresets.json", "src/triangleDebuts.json"], { cwd: cloneDir });
    await runGit(["commit", "-m", "Update puzzle presets and debut schedule"], { cwd: cloneDir });
    await runGit(["push", "origin", "main"], { cwd: cloneDir });
    console.log("Published puzzle presets and triangle debut schedule to GitHub main.");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
