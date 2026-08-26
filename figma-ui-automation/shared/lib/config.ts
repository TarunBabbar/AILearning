import 'dotenv/config';

export interface Config {
  mode: 'live' | 'sample';
  openRouterKey: string;
  figmaToken: string;
  figmaFileKey: string;
  stagingUrl: string;
  deepevalMode: 'mock' | 'server';
  deepevalUrl: string;
  dryRun: boolean;
  screensDir: string;
  specsDir: string;
  artifactsDir: string;
  reportsDir: string;
  dataDir: string;
  rootDir: string;
}

export class AppConfig implements Config {
  mode: Config['mode'];
  openRouterKey: string;
  figmaToken: string;
  figmaFileKey: string;
  stagingUrl: string;
  deepevalMode: Config['deepevalMode'];
  deepevalUrl: string;
  dryRun: boolean;
  screensDir: string;
  specsDir: string;
  artifactsDir: string;
  reportsDir: string;
  dataDir: string;
  rootDir: string;

  constructor(overrides: Partial<Config> = {}) {
    const rootDir = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

    this.mode = (process.env.MODE as Config['mode']) ?? 'live';
    this.openRouterKey = process.env.OPENROUTER_API_KEY ?? '';
    this.figmaToken = process.env.FIGMA_ACCESS_TOKEN ?? '';
    this.figmaFileKey = process.env.FIGMA_FILE_KEY ?? '';
    this.stagingUrl = process.env.STAGING_URL ?? '';
    this.deepevalMode = ((process.env.DEEPEVAL_MODE ?? 'mock') as Config['deepevalMode']);
    this.deepevalUrl = process.env.DEEPEVAL_URL ?? 'http://127.0.0.1:8010';
    this.dryRun = (process.env.DRY_RUN ?? 'true') === 'true';
    this.screensDir = `${rootDir}/agents/screens`;
    this.specsDir = `${rootDir}/specs`;
    this.artifactsDir = `${rootDir}/artifacts`;
    this.reportsDir = `${rootDir}/reports`;
    this.dataDir = `${rootDir}/data`;
    this.rootDir = rootDir;

    Object.assign(this, overrides);
  }
}

export function getConfig(overrides: Partial<Config> = {}): Config {
  return new AppConfig(overrides);
}
