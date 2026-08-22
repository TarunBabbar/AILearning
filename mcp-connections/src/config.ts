import 'dotenv/config';

export interface Config {
  openRouterApiKey: string;
  model: string;
  figmaAccessToken: string;
  figmaFileKey?: string;
  designSeries?: string[];
  figmaMcpCommand: string;
  figmaMcpArgs: string[];
  testcasesOutputDir: string;
  playwrightOutputDir: string;
  appBaseUrl: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable "${name}". Copy .env.example to .env and fill it in.`,
    );
  }
  return value.trim();
}

export function loadConfig(env = process.env): Config {
  const figmaMcpArgs = (env.FIGMA_MCP_ARGS ?? 'figma-developer-mcp --stdio')
    .split(/\s+/)
    .filter(Boolean);

  return {
    openRouterApiKey: requireEnv.call(null, 'OPENROUTER_API_KEY'),
    model: env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
    figmaAccessToken: requireEnv.call(null, 'FIGMA_ACCESS_TOKEN'),
    figmaFileKey: env.FIGMA_FILE_KEY?.trim() || undefined,
    designSeries: (env.FIGMA_DESIGN_SERIES ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    figmaMcpCommand: env.FIGMA_MCP_COMMAND ?? 'npx',
    figmaMcpArgs,
    testcasesOutputDir: env.TESTCASES_OUTPUT_DIR ?? 'output/testcases',
    playwrightOutputDir: env.PLAYWRIGHT_OUTPUT_DIR ?? 'playwright',
    appBaseUrl: env.APP_BASE_URL ?? 'http://localhost:3000',
  };
}