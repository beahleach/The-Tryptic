import { copyFile, cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const proofDir = await mkdtemp(path.join(tmpdir(), "tryptic-playtest-proof-"));
const port = process.env.PROOF_PORT || "5190";

async function exists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const shouldPipeOutput = options.silent || options.readyPattern;
    const child = spawn(command, args, {
      cwd: options.cwd || proofDir,
      env: { ...process.env, ...(options.env || {}) },
      stdio: shouldPipeOutput ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    let stdout = "";
    let stderr = "";
    let sawReady = false;

    if (shouldPipeOutput) {
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
        if (!options.silent) process.stdout.write(chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
        if (!options.silent) process.stderr.write(chunk);
      });
    }

    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0 || options.allowSignal === signal || (sawReady && (code === 143 || signal === "SIGTERM"))) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with code ${code ?? signal}`));
    });

    if (options.readyPattern) {
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`Timed out waiting for ${options.readyPattern}`));
      }, options.timeoutMs || 10000);

      const inspectOutput = (chunk) => {
        const text = String(chunk);
        if (options.readyPattern.test(text)) {
          sawReady = true;
          clearTimeout(timer);
          child.kill("SIGTERM");
        }
      };

      child.stdout?.on("data", inspectOutput);
      child.stderr?.on("data", inspectOutput);
    }
  });
}

async function copyPlaytesterFiles() {
  await mkdir(path.join(proofDir, "src"), { recursive: true });

  await Promise.all([
    cp(path.join(rootDir, "src"), path.join(proofDir, "src"), { recursive: true }),
    copyFile(path.join(rootDir, "RUN"), path.join(proofDir, "RUN")),
    copyFile(path.join(rootDir, "index.html"), path.join(proofDir, "index.html")),
    copyFile(path.join(rootDir, "package.json"), path.join(proofDir, "package.json")),
    copyFile(path.join(rootDir, "package-lock.json"), path.join(proofDir, "package-lock.json")),
    copyFile(path.join(rootDir, "vite.config.js"), path.join(proofDir, "vite.config.js")),
  ]);

  await rm(path.join(proofDir, "Puzzles"), { force: true, recursive: true });
}

try {
  console.log(`Creating proof package at ${proofDir}`);
  await copyPlaytesterFiles();

  const bundledPuzzlesPath = path.join(proofDir, "src", "bundledPuzzles.js");
  const bundledPuzzlesSource = await readFile(bundledPuzzlesPath, "utf8");
  if (!bundledPuzzlesSource.includes("SKIP_PAWN_STERN.try")) {
    throw new Error("src/bundledPuzzles.js is missing the default bundled puzzle.");
  }

  if (await exists(path.join(proofDir, "Puzzles"))) {
    throw new Error("Proof package unexpectedly contains Puzzles/.");
  }

  console.log("Installing dependencies from package-lock.json...");
  await run("npm", ["ci"]);

  console.log("Building without Puzzles/...");
  await run("npm", ["run", "build"]);

  console.log(`Starting dev server without Puzzles/ on port ${port}...`);
  await run("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", port], {
    allowSignal: "SIGTERM",
    readyPattern: /Local:\s+http:\/\/127\.0\.0\.1:/,
    timeoutMs: 10000,
  });

  console.log("Proof passed: playtester package runs without Puzzles/.");
} finally {
  await rm(proofDir, { force: true, recursive: true });
}
