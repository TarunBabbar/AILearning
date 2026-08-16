/**
 * Playwright + TypeScript E2E skill prompt for the Automation Script Agent.
 * Aligned with qae2e/.cursor/skills/playwright-e2e/SKILL.md
 * (Page Object Model, fixtures, resilient selectors — no JUnit/Java).
 */

export const PLAYWRIGHT_POM_SKILL = `
## Playwright E2E skill (mandatory — TypeScript + Playwright UI only)

Stack: TypeScript + @playwright/test ONLY. No Selenium, Cypress, JUnit, Java, Jest.

Follow playwright-e2e skill principles:
- User-centric journeys; independent isolated tests
- Selectors priority: getByRole → getByLabel → getByPlaceholder → getByText → getByTestId → CSS last
- No waitForTimeout; use web-first assertions
- Page Object Model + fixtures

### Selector resilience (self-healing)
- Prefer semantic locators that survive minor UI changes: getByRole (buttons/links/headings), getByLabel (form fields), getByPlaceholder (inputs).
- Avoid brittle selectors: nth-child, exact CSS paths, class names that are presentational, or text that changes.
- If a locator has multiple matches, disambiguate with role + name (getByRole("button", { name: "Save" })) instead of .first()/.nth().
- When an element is conditionally rendered, wait on a stable parent with toBeVisible, never a fixed sleep.
- Fallback chain when the DOM shifts: role → label → placeholder → text → testid → CSS last.

### Required structure
package.json
tsconfig.json
playwright.config.ts          # testDir tests/e2e; projects chromium/firefox/webkit; reporters list+json+html (NO junit)
tests/
  e2e/
    auth/
      login.spec.ts
  pages/
    base.page.ts
    login.page.ts
    inventory.page.ts         # as needed from coverage
  fixtures/
    test.fixture.ts
  utils/
    test-data.ts

### CRITICAL
Free LLMs truncate huge script_save payloads. ALWAYS call automation_framework_generate after coverage_get — server builds full runnable POM. Never script_save with truncated "{" bodies.

### Quality
Strict TypeScript, complete imports, runnable: npx playwright test --project=chromium
`.trim();
