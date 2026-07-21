# Learning: Playwright + TypeScript Test Automation Framework

> A from-scratch learning journey to master test automation using TypeScript, Playwright, MCP, BDD, and API testing — built with industry best practices.

---

## 🎯 About This Project

This repository is a **learning-by-doing** guide for anyone new to test automation. Starting from zero — no prior Playwright or TypeScript knowledge assumed — it builds a production-grade test automation framework step by step.

**Target application:** [SauceDemo](https://www.saucedemo.com) (a demo e-commerce site)
**Free APIs used:** [ReqRes](https://reqres.in) | [RESTful-API](https://restful-api.dev)

Each phase is documented with:
- What you'll learn
- Why we do it that way
- Code you can run and modify

---

## 📚 Learning Phases

| Phase | Topic | Status |
|---|---|---|
| [Phase 1](./learning/phase-1-project-scaffold.md) | Project scaffold — `package.json`, `tsconfig.json`, `playwright.config.ts`, from-scratch setup | ✅ Done |
| Phase 2 | Page Object Model + Fixtures + Test Data | 🚧 In Progress |
| Phase 3 | API Automation (ReqRes, RESTful-API) | ⬜ Pending |
| Phase 4 | E2E Hybrid Flows (UI + API combined) | ⬜ Pending |
| Phase 5 | BDD with Cucumber + Playwright | ⬜ Pending |
| Phase 6 | MCP — Markdown-driven test execution | ⬜ Pending |
| Phase 7 | CI/CD, Docker, Reports, Production readiness | ⬜ Pending |

---

## 🏗️ Project Structure

```
learning-playwright-typescript-framework/
├── learning/               # 📖 Phase-wise learning documentation
│   └── phase-1-project-scaffold.md
├── src/
│   ├── pages/              # 📄 Page Object Model
│   │   ├── BasePage.ts
│   │   ├── LoginPage.ts
│   │   ├── InventoryPage.ts
│   │   ├── CartPage.ts
│   │   └── CheckoutPage.ts
│   ├── data/               # 🗃️ Centralized test data
│   │   └── test-data.ts
│   ├── fixtures/           # 🔧 Custom Playwright fixtures
│   │   └── test.fixture.ts
│   └── utils/              # 🛠️ Utilities (API client, etc.)
│       └── ApiClient.ts
├── tests/
│   ├── ui/                 # 🖥️ UI tests
│   │   └── sauedemo.spec.ts
│   ├── api/                # (Phase 3)
│   └── e2e/                # (Phase 4)
├── features/               # (Phase 5 — BDD .feature files)
├── package.json
├── tsconfig.json
├── playwright.config.ts
└── saucedemo.md            # 📝 Scenario file for MCP-driven execution (Phase 6)
```

---

## 🔑 Key Principles

| Principle | How We Apply It |
|---|---|
| **SOLID** | Single responsibility per page; BasePage for shared behavior |
| **DRY** | Centralized test data; reusable POM; fixtures avoid repeated login |
| **AAA** | Every test: Arrange → Act → Assert |
| **Resilient Locators** | `getByRole()` > `getByText()` > `getByPlaceholder()` > `data-test` |
| **No Hardcoded Values** | All credentials, URLs, messages in `test-data.ts` |
| **Isolated Tests** | Fresh browser context per test; no shared mutable state |

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Run all tests
npm test

# Run tests with browser visible
npm run test:headed

# Open Playwright UI runner
npm run test:ui

# View HTML report
npm run report
```

---

## 📝 Progress Log

- **Phase 1 Complete** — Project scaffold, config files, core understanding of `package.json`, `tsconfig.json`, `playwright.config.ts`
- **Currently Learning** — Page Object Model design and custom Playwright fixtures

---

> This is a living document. Updated with each learning phase.
