import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url)); // scripts/lib
const root = path.resolve(here, "..", ".."); // project root

// Load .env.local first (secrets / real values), then .env as fallback.
// dotenv does not override already-set vars, so .env.local wins.
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });