#!/usr/bin/env node
import { loadConfig } from './config.js';
import { runPipeline } from './orchestrator/pipeline.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
figma2pw — turn a Figma design into Playwright + TypeScript tests via AI agents.

Usage:
  figma2pw                 run the full pipeline (needs .env)
  figma2pw --help          show this help

Requirements (.env):
  OPENROUTER_API_KEY       OpenRouter key for the LLM agents
  OPENROUTER_MODEL         LLM model to use, e.g. openai/gpt-4o-mini
  FIGMA_ACCESS_TOKEN       Figma personal access token
  FIGMA_FILE_KEY           File key from your Figma URL

Flow: connect to Figma MCP -> analyze design -> generate test cases
      -> generate + scaffold Playwright/TS automation.
`);
    return;
  }

  const config = loadConfig();
  console.log(`[figma2pw] model=${config.model} file=${config.figmaFileKey ?? '(unset)'}`);
  const assets = await runPipeline(config);
  console.log(
    `[figma2pw] finished: ${assets.analysis.productName} | ${assets.testCases.length} cases | ${assets.files.length} files.`,
  );
}

main().catch((err) => {
  console.error(`\n[figma2pw] FATAL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});