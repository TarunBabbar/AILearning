/**
 * One-time / manual company resolution for the job-details app.
 *
 * Resolves company details (name, type, description, location, website) from
 * email domains found on jobs and persists them to the Company table, linking
 * jobs → company. Run it whenever new jobs are uploaded:
 *
 *   npm run resolve-companies
 *
 * The UI never triggers this — it only reads the persisted Company rows.
 */
import { config as loadEnv } from "dotenv";
// Load .env for API key / model, but never override an externally-set
// DATABASE_URL, so the same script can target a remote DB (e.g. the Neon prod
// DB):
//   set DATABASE_URL=<neon-url>&& npm run resolve-companies
loadEnv({ override: false, path: ".env" });

// Dynamic import so the modules below see the env vars loaded above.
// (ESM imports are hoisted, so a static import would evaluate lib/db before
// dotenv runs and the DB connection would be misconfigured.)
const [{ resolveApiKey }, { getConfig }, { resolveAndStoreCompanyDetails }] =
  await Promise.all([
    import("@/lib/auth"),
    import("@/lib/config"),
    import("@/lib/resolve-companies"),
  ]);

async function main() {
  const { apiKey } = resolveApiKey();
  if (!apiKey) {
    console.error(
      "No OpenRouter API key configured. Set OPENROUTER_API_KEY in .env and retry."
    );
    process.exit(1);
  }

  const cfg = getConfig();
  if (!cfg.llmModel) {
    console.error("No OpenRouter model configured. Set OPENROUTER_MODEL in .env and retry.");
    process.exit(1);
  }

  console.log(
    `Resolving company details with model "${cfg.llmModel}"…\n` +
      `  · Saves after each batch of 25\n` +
      `  · Auto-retries on 429 (rate limit) with long backoff\n` +
      `  · Safe to re-run if interrupted — already-resolved domains are skipped`
  );

  // No limit — process every unresolved domain (local / CI, not Vercel).
  const { resolved, created, total, remaining } =
    await resolveAndStoreCompanyDetails(apiKey, cfg.llmModel, 0);

  console.log(
    `Done. Resolved ${resolved} domain(s), created ${created} new company row(s). ` +
      `Total companies in DB: ${total}. Remaining unresolved: ${remaining}.`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
