# QAE2E — Connector Settings & Feature Roadmap

This doc covers two things:

1. How to redesign connector management so users can save Jira/Confluence/Figma/GitHub/Zephyr/TestRail/Pinecone credentials from a single **Settings** tab, including what auth mechanism each service actually uses.
2. A consolidated backlog — new functional areas (API testing, self-healing, etc.) plus the connector/settings work — as a single checklist.

---

## 1. Current state

- Credentials already live per-workspace in `workspace_secrets` (DB-backed, not `.env`) — good foundation.
- `ConnectorsPanel` in the workspace right rail shows status and lets you test/save. It's scattered inside the workspace UI rather than a dedicated Settings surface, and each connector's required fields are hardcoded per integration rather than driven by a shared schema.
- No distinction yet between **API-key-style** connectors (paste a token) and **OAuth-style** connectors (redirect + consent + refresh token).

## 2. Target architecture: a real Settings tab

### 2.1 Connector registry (schema-driven, not hardcoded forms)

Define each connector once as data, and render the Settings UI generically from it:

```ts
type ConnectorField = {
  key: string;                 // e.g. "apiToken"
  label: string;                // e.g. "API Token"
  type: "text" | "password" | "url" | "select";
  required: boolean;
  helpText?: string;
  helpUrl?: string;             // deep link to the provider's "generate a token" page
};

type ConnectorDef = {
  id: "jira" | "confluence" | "figma" | "github" | "zephyr" | "testrail" | "pinecone" | "openrouter";
  name: string;
  authType: "api_token" | "basic_auth" | "bearer_token" | "oauth2";
  fields: ConnectorField[];
  testEndpoint: string;         // used by the "Test connection" button
  docsUrl: string;
};
```

This lets you add a new connector by adding one registry entry instead of a new form component — and it's the same shape the existing `connector_status` MCP tool already partially models, so extending it is incremental, not a rewrite.

### 2.2 Settings tab structure

- **Account** — email, password change, sessions.
- **Workspaces** — existing dashboard, unchanged.
- **Integrations** *(new, promoted out of the workspace right rail)*:
  - One card per connector: status chip (Connected / Missing fields / Invalid), masked credential preview (`sk-...ab12`), **Test connection**, **Save**, **Disconnect**.
  - Fields rendered from the registry above — password-type fields masked with a reveal toggle.
  - A "Required for" hint per field (e.g. "needed to fetch requirements from Jira" vs "needed to publish results").
- **API usage** — which free OpenRouter/vision model is active, rate-limit status.

### 2.3 Secret handling

- Keep secrets in Postgres (`workspace_secrets`), but **encrypt values at rest** with an app-level key (e.g. AES-256-GCM using a `SECRETS_ENCRYPTION_KEY` env var), not just DB access control — right now anyone with DB access can read tokens in plaintext.
- Never echo the full secret back to the client after save — return a masked version (`****ab12`) and only decrypt server-side when a connector call is made.
- Add a **rotate/revoke** action per connector, and an audit trail (`who changed which connector, when`) — useful once workspaces have more than one member.
- "Test connection" should hit a lightweight read-only endpoint for each provider (e.g. Jira `/myself`, TestRail `get_projects`, Figma `/v1/me`) before saving, so bad credentials are caught immediately instead of failing mid-pipeline.

### 2.4 API-token vs OAuth — which to use per connector

Two integration patterns exist across these tools. API tokens are simpler to ship first; OAuth is better UX long-term for Jira/Confluence/GitHub since users don't have to manually mint and paste tokens.

| Connector | Simplest auth (ship first) | Better long-term option |
|---|---|---|
| Jira Cloud | Email + API token, HTTP Basic Auth | Atlassian OAuth 2.0 (3LO) — user clicks "Connect Jira", consents, you store refresh token |
| Confluence Cloud | Same as Jira — email + API token, Basic Auth (same Atlassian account) | Same Atlassian OAuth 2.0 app can cover both Jira + Confluence scopes at once |
| Figma | Personal access token, sent as `X-Figma-Token` header | Figma OAuth2 app (better if you don't want users generating PATs manually) |
| GitHub | Fine-grained PAT, `Authorization: Bearer <token>` | GitHub App install (per-repo scoped, no user PAT to manage/rotate) |
| Zephyr Scale | API access token (JWT), generated from Jira profile → "Zephyr Scale API Access Tokens", sent as `Authorization: Bearer <token>`. Token is **user-scoped and expires periodically** (commonly ~3 months) — surface an expiry warning in the UI. | No first-party OAuth; token remains the standard path |
| TestRail | Username (email) + API key, HTTP Basic Auth (`user@example.com:<api_key>`) — API key generated under *My Settings → API Keys*. Newly generated keys can take ~15–20 min to activate — worth a note in the UI so a "Test connection" failure right after saving doesn't look like a bug. | Username/password Basic Auth also works but API key is recommended over raw password |
| Pinecone | API key (`Api-Key` header), plus index name/host | N/A — API key is the standard/only method |
| OpenRouter | API key (`Authorization: Bearer <key>`) | N/A |

**Practical recommendation:** ship all connectors as API-token/Basic-Auth first (you already have working REST clients for most of these) since it requires no redirect-URI/app-registration work. Add OAuth for Jira+Confluence and GitHub later as a UX upgrade — those are the two where users are most likely to churn on manually generating tokens.

### 2.5 Per-connector setup copy (for the help text / docs links)

- **Jira/Confluence**: "Generate an API token from your Atlassian account → Security → API tokens. Use your account email as the username."
- **Figma**: "Generate a personal access token from Figma → Settings → Personal access tokens."
- **GitHub**: "Create a fine-grained PAT scoped to just the repo(s) you want QAE2E to read/write."
- **Zephyr Scale**: "Generate a token from your Jira profile icon → Zephyr Scale API Access Tokens. Tokens expire periodically — you'll need to regenerate and re-save here."
- **TestRail**: "Generate an API key from My Settings → API Keys in TestRail. Enter it together with your TestRail login email. New keys can take up to 20 minutes to activate."
- **Pinecone**: "Create a free serverless index and paste its API key + host here."

---

## 3. Consolidated backlog

### A. Connector & Settings overhaul (this conversation)
- [ ] Build a schema-driven `ConnectorDef` registry (id, authType, fields, testEndpoint, docsUrl) covering Jira, Confluence, Figma, GitHub, Zephyr, TestRail, Pinecone, OpenRouter
- [ ] Move connector management out of the workspace right rail into a dedicated **Settings → Integrations** tab, rendered generically from the registry
- [ ] Encrypt secrets at rest (`SECRETS_ENCRYPTION_KEY`), mask on read, decrypt only server-side at call time
- [ ] Add **Test connection** using each provider's lightest read-only endpoint before allowing Save
- [ ] Add rotate/revoke actions + an audit log of credential changes per workspace
- [ ] Add expiry awareness for tokens that expire (Zephyr Scale) — warn before pipeline runs if a token is close to/past expiry
- [ ] (Later) Add Atlassian OAuth 2.0 (3LO) app for Jira + Confluence as an alternative to pasting API tokens
- [ ] (Later) Add a GitHub App install flow as an alternative to PATs

### B. Test coverage breadth
- [ ] API/contract testing agent — generate REST/GraphQL test cases from an OpenAPI spec or ticket, run via Playwright's `request` context
- [ ] Visual regression — `toHaveScreenshot` (or Percy/Chromatic) baseline diffing wired into generated specs
- [ ] Accessibility checks — `@axe-core/playwright` in generated specs, feed violations into release confidence

### C. Test intelligence
- [ ] Self-healing locators — when a selector breaks, have the AS agent re-inspect the DOM and propose a fix automatically
- [ ] Flaky test detection — track pass/fail history per test across runs, auto-quarantine intermittent failures
- [ ] Risk-based test selection — use `github_read_repo`/diff on a PR to prioritize which existing cases are impacted, instead of always running the full suite

### D. Ops & collaboration
- [ ] Slack/Teams/email notifications on pipeline completion or release-confidence threshold breach
- [ ] PR comments summarizing test results (pairs with existing GitHub check-in flow)
- [ ] Scheduled/cron regression runs against a fixed environment
- [ ] Team workspaces with roles (e.g. reviewer/approver for AI-drafted coverage) — current model is single-owner

### E. Reporting
- [ ] Trends dashboard — coverage %, pass rate, flakiness, release confidence over time, built on existing run history data

---

*Priority suggestion: do **A** first (it unblocks reliable use of every connector), then **C** (risk-based selection + flaky detection give the best ROI on top of what's already built), then **B**, then **D/E**.*