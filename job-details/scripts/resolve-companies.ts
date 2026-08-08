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
loadEnv({ override: true, path: ".env" });

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
    `Resolving company details with model "${cfg.llmModel}"… (this can take a few minutes)`
  );

  const { resolved, created, total } = await resolveAndStoreCompanyDetails(
    apiKey,
    cfg.llmModel
  );

  console.log(
    `Done. Resolved ${resolved} domain(s), created ${created} new company row(s). ` +
      `Total companies in DB: ${total}.`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
