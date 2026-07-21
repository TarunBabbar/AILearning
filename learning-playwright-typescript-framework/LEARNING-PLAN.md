# TypeScript + Playwright + MCP Test Automation Learning Plan

## Learning Roadmap

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
(TS+Playwright) (POM+Fixtures) (API) (E2E Hybrid) (BDD/Cucumber) (MCP+MD) (CI/CD)
```

**Target App:** [saucedemo.com](https://www.saucedemo.com)
**Free APIs:** [ReqRes](https://reqres.in) | [RESTful-API](https://restful-api.dev)

---

## Phase 1: Project Scaffold & Playwright Basics

| File | Purpose |
|---|---|
| `package.json` | Scripts: `test`, `test:ui`, `test:headed`, `test:debug`, `report` |
| `tsconfig.json` | Strict mode, ES2022, path aliases |
| `playwright.config.ts` | baseURL: saucedemo.com, 3 browsers, HTML reporter, trace on retry |

---

## Phase 2: Page Object Model + Fixtures

```
src/
├── pages/
│   ├── BasePage.ts          Shared: navigate, fillField, clickElement, expectVisible
│   ├── LoginPage.ts         Login locators + loginAs(), getErrorMessage()
│   ├── InventoryPage.ts     Product list, addToCart(), sortBy()
│   ├── CartPage.ts          getCartItems(), removeItem(), checkout()
│   └── CheckoutPage.ts      fillCustomerInfo(), finish(), getConfirmationMessage()
├── data/
│   └── test-data.ts         Credentials, Products, Prices, ErrorMessages, URLs
├── fixtures/
│   └── test.fixture.ts      Custom fixtures: loginPage, authenticatedPage
└── utils/
    └── ApiClient.ts         Reusable API request wrapper
```

**Locator priority:** `getByRole()` > `getByText()` > `getByPlaceholder()` > `data-test`

---

## Phase 3: API Automation

**ReqRes** (`reqres.in/api`): GET users, POST create, PUT update, PATCH, DELETE
**RESTful-API** (`restful-api.dev/objects`): Full CRUD lifecycle (data persists)

---

## Phase 4: E2E Hybrid Flows

- Full checkout: Login → Add → Cart → Checkout → Confirmation
- API seed + UI verify
- Network interception (mock, slow network, errors)
- Visual regression (`toHaveScreenshot`)

---

## Phase 5: BDD with Cucumber

```
features/
├── login.feature           @smoke scenarios
├── checkout.feature
├── cart.feature
├── inventory.feature
└── support/
    ├── world.ts
    ├── hooks.ts
    └── steps/
        ├── login.steps.ts
        ├── inventory.steps.ts
        ├── cart.steps.ts
        └── checkout.steps.ts
cucumber.js
```

Dependencies: `@cucumber/cucumber`, `@cucumber/pretty-formatter`

---

## Phase 6: MCP — Markdown-Driven Execution

```
saucedemo.md  →  MCP Server  →  Playwright Runner  →  Results (JSON/MD)
```

```
src/mcp/
├── server.ts                  MCP server (StdioServerTransport)
├── tools/
│   ├── run-scenario.ts        Parse .md → run all test cases
│   └── list-scenarios.ts      List available scenario files
├── parser/
│   └── markdown-parser.ts     Parse .md → TestCase[] objects
├── executor/
│   └── test-executor.ts       Mapped steps → POM calls → Playwright
└── mapper/
    └── step-mapper.ts         Natural language → POM method mapping
```

MCP tools exposed:
- `run_scenario(file)` — Runs all test cases from a .md file
- `list_scenarios()` — Lists available .md scenario files

---

## Phase 7: CI/CD & Production

- GitHub Actions with sharding
- ESLint + Prettier
- Dockerfile (Playwright image)
- Husky pre-commit hooks

---

## Coding Principles

| Principle | How Applied |
|---|---|
| **SOLID** | Single responsibility per page; BasePage for shared behavior |
| **DRY** | Centralized test data; reusable POM; fixtures avoid repeated login |
| **AAA** | Every test: Arrange → Act → Assert separated by blank lines |
| **Resilient locators** | Role-based > Text-based > Placeholder > data-test |
| **No hardcoded values** | All data in `test-data.ts` |
| **Isolated tests** | Fresh page per test; no shared mutable state |
| **Fail fast** | Clear assertion messages |
