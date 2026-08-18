import { Octokit } from "octokit";
import { prisma } from "../db";
import { decryptSecret } from "../secrets";

/**
 * GitHub connector — direct REST via Octokit (Vercel-friendly, replaces MCP).
 * Read-scoped: repo contents, tree, existing test files, PR diffs.
 */
export async function getGitHubClient(workspaceId: string): Promise<Octokit> {
  const conn = await prisma.connection.findFirst({
    where: { workspaceId, type: "github" },
  });
  if (!conn) throw new Error("GitHub not connected for this workspace");
  const token = decryptSecret(conn.secretCiphertext);
  return new Octokit({ auth: token });
}

export interface RepoRef {
  owner: string;
  repo: string;
}

/** Parse "owner/repo" from scope config or a URL. */
export function parseRepo(input: string): RepoRef {
  const cleaned = input.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\.git$/, "");
  const [owner, repo] = cleaned.split("/");
  if (!owner || !repo) throw new Error(`Invalid repo: ${input}`);
  return { owner, repo };
}

/** List test-like files across the repo tree (tests/, spec/, e2e/ hints). */
const TEST_DIR_HINTS = ["tests/", "test/", "spec/", "specs/", "e2e/", "__tests__/", "cypress/", "playwright/"];
const TEST_FILE_RE = /(test|spec|e2e)[._-].*\.(py|js|ts|tsx|jsx)$|^.*[._-](test|spec)\.(py|js|ts|tsx|jsx)$/i;

export async function listRepoFiles(client: Octokit, repo: RepoRef, branch = "main"): Promise<string[]> {
  const { data } = await client.rest.git.getTree({
    owner: repo.owner,
    repo: repo.repo,
    tree_sha: branch,
    recursive: "1",
  });
  return (data.tree ?? [])
    .filter((t) => t.type === "blob" && t.path)
    .map((t) => t.path!);
}

export function discoverTestFiles(files: string[]): string[] {
  return files.filter(
    (p) => TEST_DIR_HINTS.some((h) => p.startsWith(h)) || TEST_FILE_RE.test(p)
  );
}

export async function readFile(client: Octokit, repo: RepoRef, path: string, branch = "main"): Promise<string> {
  const { data } = await client.rest.repos.getContent({
    owner: repo.owner,
    repo: repo.repo,
    path,
    ref: branch,
  });
  if ("content" in data && typeof data.content === "string") {
    return Buffer.from(data.content, "base64").toString("utf8");
  }
  throw new Error(`Not a file: ${path}`);
}
