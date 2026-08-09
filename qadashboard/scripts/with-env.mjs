import { config as loadEnv } from "dotenv";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadEnv({ path: resolve(root, ".env"), override: true });

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/with-env.mjs <command> [...args]");
  process.exit(1);
}

const child = spawn(args[0], args.slice(1), {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
