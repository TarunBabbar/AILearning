---
name: playwright-ts-pom
description: >-
  Generate buildable Playwright + TypeScript UI automation using Page Object
  Model, SOLID layout, cross-browser config, and a scalable folder structure.
  Use when writing or reviewing QAE2E automation scripts, Playwright specs,
  page objects, fixtures, or when the Automation Script (AS) agent must emit
  runnable framework code via script_save.
---

# Playwright + TypeScript POM Framework

## Goal

Emit a **complete, runnable** UI automation mini-framework — not loose specs.
Code must compile under `strict` TypeScript, run with `npx playwright test`,
and work across Chromium / Firefox / WebKit.

## Hard constraints

- Stack: **TypeScript + @playwright/test only** (no Selenium, Cypress, WebdriverIO)
- Pattern: **Page Object Model** — specs never touch raw locators for business flows
- Selectors: prefer `getByRole` / `getByLabel` / `getByPlaceholder` / `getByTestId`
- No `waitForTimeout`. Use web-first assertions and locator auto-wait
- Every file must be complete (imports, types, exports) — no stubs / `// TODO implement`
- `script_save` files must include **framework scaffold + pages + fixtures + data + specs**

## Required folder structure

```
package.json
tsconfig.json
playwright.config.ts
src/
  pages/
    BasePage.ts
    <Feature>Page.ts      # one class per screen / major UI area
    index.ts              # barrel export
  fixtures/
    test.fixture.ts       # extend base test with page objects
  data/
    test-data.ts          # URLs, credentials placeholders, constants
tests/
  ui/
    <feature>.spec.ts     # scenarios only — call page methods
```

## SOLID mapping

| Principle | Practice |
|-----------|----------|
| **S**ingle responsibility | Page = locators + actions; Spec = scenario orchestration; Data = constants |
| **O**pen/closed | New screens = new `*Page` extending `BasePage`; do not edit BasePage for features |
| **L**iskov | Page objects usable wherever `BasePage` helpers are expected |
| **I**nterface segregation | Fixtures expose only pages the suite needs |
| **D**ependency inversion | Specs depend on fixtures/page APIs, never on CSS strings |

## BasePage contract

```ts
import { Page, Locator, expect } from "@playwright/test";

export class BasePage {
  constructor(protected readonly page: Page) {}

  async navigate(path: string): Promise<void> {
    await this.page.goto(path);
  }

  async fillField(locator: Locator, value: string): Promise<void> {
    await locator.fill(value);
  }

  async clickElement(locator: Locator): Promise<void> {
    await locator.click();
  }

  async expectVisible(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible();
  }

  async expectURL(expected: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(expected);
  }
}
```

Feature pages: private `Locator` fields in constructor, public async methods named after user intent (`loginAs`, `submitForm`, `expectError`).

## Fixtures

```ts
import { test as base } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";

type AppFixtures = { loginPage: LoginPage };

export const test = base.extend<AppFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});

export { expect } from "@playwright/test";
```

Specs import `{ test, expect }` from `../../src/fixtures/test.fixture` — never raw `@playwright/test` when fixtures exist.

## playwright.config.ts (cross-browser)

Must define `projects` for `chromium`, `firefox`, `webkit` via `devices`.
Set `testDir: "./tests"`, `fullyParallel: true`, `use.baseURL` from env or sensible default,
`trace: "on-first-retry"`, `screenshot: "only-on-failure"`, reporter include `list` + `junit` when CI.

## package.json / tsconfig.json

- `devDependencies`: `@playwright/test`, `typescript`, `@types/node`
- Scripts: `test`, `test:headed`, `test:ui`, `report`
- `tsconfig`: `strict: true`, `module: commonjs`, `target: ES2022`, include `src/**`, `tests/**`, `playwright.config.ts`

## Spec rules

- One `test.describe` per feature area; one `test()` per coverage case (title mirrors case title)
- Tag smoke vs regression with `@smoke` / `@regression` in test name when priorities differ
- Arrange → Act → Assert using page methods only
- Derive steps from **coverage testCases** — do not invent unrelated flows
- If UI URL/selectors unknown: use `getByRole`/`getByLabel` with names from the case steps; put `BASE_URL` in `test-data.ts` as placeholder env `process.env.BASE_URL ?? "http://localhost:3000"`

### script_save vs automation_framework_generate

- **Prefer `automation_framework_generate`** — server builds full POM from coverage (never truncated).
- Avoid `script_save` with large `files[]` on free models — args get cut to `"{"`.
- Quality checklist still applies to whatever is persisted.
