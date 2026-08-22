# Figma → Playwright Agent Pipeline

Turns a Figma UI design into a runnable **Playwright + TypeScript** test suite,
driven end-to-end by **AI agents** over an **OpenRouter** LLM and the official
**Figma MCP server**.

```
┌──────────────┐   MCP    ┌────────────────┐   design JSON    ┌─────────────────┐
│  Figma MCP   │ ───────► │   Orchestrator │ ───────────────► │  Agent 1/3      │
│  (server)    │          │  (pipeline)    │                  │  Design Analysis│
└──────────────┘          └────────────────┘                  └─────────────────┘
        ▲ questions                  │  analysis (JSON/markdown)
        │  ideas                     ▼
                                ┌─────────────────┐   test cases   ┌─────────────────┐
                                │  Agent 2/3      │ ─────────────► │  Agent 3/3      │
                                │  Test Cases     │                │  Automation     │
                                └─────────────────┘                └─────────────────┘
                                                                          │
                                                Playwright + TS project (playwright/)
```

## Why agents?
- **Agent 1 (Analysis)** reads the Figma layout/nodes and image renders and
  distills them into a structured UX analysis — pages, elements, interactions.
- **Agent 2 (Test Cases)** converts that analysis into a prioritized, Gherkin-free
  list of automation-ready test cases with deterministic selectors.
- **Agent 3 (Automation)** emits TypeScript Playwright tests + page objects and we
  scaffold them into a project that runs with `npm test`.

## Requirements
- Node.js 18+ (native `fetch`).
- An [OpenRouter](https://openrouter.ai/keys) API key and your model id.
- A [Figma personal access token](https://www.figma.com/developers/api#access-tokens).
- `npx` available in your PATH (the Figma MCP server is launched via `npx`).

## Setup
```bash
npm install
cp .env.example .env
# edit .env: OPENROUTER_API_KEY, OPENROUTER_MODEL, FIGMA_ACCESS_TOKEN, FIGMA_FILE_KEY
```

Remove the `FIGMA_FILE_KEY` from your Figma URL:
`https://www.figma.com/design/<THIS_IS_THE_KEY>/...`

Optional: `FIGMA_DESIGN_SERIES=Pricing,Signup` restricts frame renders to nodes
whose name mentions those labels.

## Run
```bash
npm run pipeline        # build + run
# or
npx tsx src/cli.ts      # dev mode (no build)
```

First run downloads the Figma MCP server via `npx`. Output:
- `output/testcases/test-cases.md` — the generated test-case doc.
- `playwright/` — the generated Playwright + TypeScript project.

## Run the generated tests
```bash
cd playwright
npm install
npm run install:deps    # Chromium
npm run test
```
Point `baseURL` at your running app (default from `APP_BASE_URL`). The generated
specs assume the app matches the Figma design.

## How it uses MCP
The orchestrator spawns the [Framelink/`figma-developer-mcp`](https://github.com/GLips/Figma-Context-MCP)
server as a child process over stdio (`npx figma-developer-mcp --stdio`), lists its
tools (`get_figma_data`, `download_figma_images`, …) and calls `get_figma_data`
with the file key to get a simplified serialized summary of the design. The token
is passed to the server as `FIGMA_API_KEY` (your `FIGMA_ACCESS_TOKEN`), keeping
auth inside the MCP server rather than scattered through the code.

> **Windows note:** the default `FIGMA_MCP_COMMAND=npx` works when `npx.cmd` is on
> your PATH. If the spawn fails on Windows, set `FIGMA_MCP_COMMAND=cmd` and
> `FIGMA_MCP_ARGS=/c npx -y figma-developer-mcp --stdio`.

## Project layout
```
src/
  cli.ts                 entrypoint
  config.ts              .env loader + config
  llm/openrouter.ts      minimal OpenRouter (OpenAI-compatible) client
  agents/
    schema.ts            JSON shapes shared across agents
    analysisAgent.ts     Agent 1
    testCaseAgent.ts     Agent 2
    automationAgent.ts   Agent 3
  figma/figmaMcp.ts      MCP client (spawn + tool calls)
  figma/loader.ts        fetch design data (get_figma_data / get_file fallback)
  orchestrator/pipeline.ts  the 4-stage pipeline
  playwright/scaffold.ts Playwright project templates
```