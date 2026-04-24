import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const viteArgs = process.argv.slice(2);

function startProcess(label, command, args) {
  const child = spawn(command, args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`${label} exited from signal ${signal}.`);
      return;
    }

    if (typeof code === "number" && code !== 0) {
      console.error(`${label} exited with code ${code}.`);
      process.exitCode = code;
    }
  });

  return child;
}

const children = [
  startProcess("backend", npmCommand, ["run", "dev:server"]),
  startProcess("frontend", npmCommand, ["run", "dev:client", "--", ...viteArgs]),
];

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    shutdown(signal);
    process.exit(0);
  });
}

