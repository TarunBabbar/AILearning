import type { Config } from '../../shared/lib/config.ts';
import { log } from '../../shared/lib/logger.ts';
import { getSampleSpec } from '../design-extraction/sample.ts';
import type { Element as SpecElement, ElementRole, Spec } from '../../shared/types/index.ts';
import { perturbPng, renderSpecPng } from '../validation/render.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface ImplInspectionResult {
  spec: Spec;
  screenshotPath?: string;
  provider: string;
  warnings: string[];
}

function toHex(color: string): string {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  if (!m) return color;
  const [r, g, b] = [m[1], m[2], m[3]].map((n) => parseInt(n, 10));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function inferRoleFromEl(el: { tagName: string; type?: string; role?: string | null }): ElementRole {
  const tag = el.tagName.toLowerCase();
  if (el.role) return el.role.toLowerCase() as ElementRole;
  if (tag === 'button' || tag === 'a' || (el.type && ['submit', 'button'].includes(el.type))) return 'button';
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'input';
  if (el.type && ['email', 'password', 'text', 'search', 'tel'].includes(el.type)) return 'input';
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) return 'heading';
  if (tag === 'a') return 'link';
  if (tag === 'img' || tag === 'svg') return 'image';
  if (tag === 'nav') return 'nav';
  if (tag === 'ul' || tag === 'ol' || tag === 'li') return 'list';
  if (tag === 'form') return 'form';
  return 'other';
}

/**
 * Agent 2 — Implementation Inspector.
 * Crawls the live/staging URL with Playwright and emits an impl-spec in the SAME shape
 * as the design spec, so drift diffing is structural. Adds locators for codegen.
 */
export class ImplementationInspectorAgent {
  private cfg: Config;

  constructor(cfg: Config) {
    this.cfg = cfg;
  }

  async run(screenId: string): Promise<ImplInspectionResult> {
    if (this.cfg.mode === 'sample') return this.runSample(screenId);

    if (!this.cfg.stagingUrl) throw new Error('STAGING_URL is not set; add it to .env or run in sample mode');

    log.info('impl-inspector', `crawling ${this.cfg.stagingUrl} (screen ${screenId})`);
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(this.cfg.stagingUrl, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(500);

      const rawElements = await page.evaluate(() => {
        const root = document.body;
        const els = root.querySelectorAll<HTMLElement>(
          'button, a, input, textarea, select, h1, h2, h3, h4, h5, h6, img, nav, form, [role], [data-testid]',
        );
        const out: Array<Record<string, unknown>> = [];
        els.forEach((el, i) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return;
          const cs = getComputedStyle(el);
          const id = `impl-${i}`;
          const name = el.getAttribute('data-testid') || el.getAttribute('name') || el.textContent?.trim().slice(0, 40) || el.tagName;
          const tag = el.tagName.toLowerCase();
          const role = el.getAttribute('role') || (tag === 'button' ? 'button' : tag === 'a' ? 'link' : tag === 'input' ? 'input' : 'text');
          out.push({
            id,
            name,
            type: tag,
            role,
            text: el.textContent?.trim()?.slice(0, 200) ?? '',
            bounds: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
            styles: {
              color: toHex(cs.color),
              bg: toHex(cs.backgroundColor),
              fontSize: parseFloat(cs.fontSize) || undefined,
              fontWeight: parseInt(cs.fontWeight, 10) || undefined,
              fontFamily: cs.fontFamily.split(',')[0].replace(/['"]/g, ''),
              radius: parseFloat(cs.borderRadius) || undefined,
              border: cs.borderWidth !== '0px' ? `${cs.borderStyle} ${cs.borderWidth} ${cs.borderColor}` : undefined,
            },
            a11y: {
              label: el.getAttribute('aria-label') || undefined,
              ariaProps: {
                role: el.getAttribute('role') || undefined,
                disabled: el.getAttribute('aria-disabled') || undefined,
                type: el.getAttribute('type') || undefined,
              },
            },
            locator: {
              css: tag + (el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : el.id ? `#${el.id}` : ''),
              role: el.getAttribute('role') || undefined,
              testId: el.getAttribute('data-testid') || undefined,
              text: el.textContent?.trim()?.slice(0, 80) || undefined,
            },
            actual: { tagName: el.tagName, display: cs.display, visibility: cs.visibility },
          });
        });
        return out;
      });

      const spec: Spec = {
        schemaVersion: 1,
        kind: 'impl',
        screen: {
          id: screenId,
          name: `${screenId} (live)`,
          source: 'playwright-crawl',
          retrievedAt: new Date().toISOString(),
        },
        viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
        elements: (rawElements as unknown as Array<Record<string, unknown>>).map((e) => ({
          ...(e as unknown as SpecElement),
          role: inferRoleFromEl({ tagName: String(e.tagName ?? ''), type: e.type as string | undefined, role: e.role as string | null | undefined }),
        })),
        interactions: [],
      };

      const screenshotPath = `${this.cfg.artifactsDir}/screens/${screenId}/impl.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });

      return { spec, screenshotPath, provider: 'playwright-crawl', warnings: [] };
    } finally {
      await browser.close();
    }
  }

  private runSample(screenId: string): ImplInspectionResult {
    const design = getSampleSpec(screenId);
    if (!design) throw new Error(`No sample spec for screen "${screenId}" (available: login, checkout)`);

    // Simulate the live UI: same layout, but with a deterministic "drift" so
    // Pipeline A produces a real (small) diff to inspect.
    const severity = screenId === 'login' ? 'moderate' : 'none';
    const impl: Spec = {
      ...design,
      kind: 'impl',
      screen: { ...design.screen, name: `${design.screen.name} (sample impl)`, source: 'sample' },
      elements: design.elements.map((el, idx) => {
        // simulate a real drift: shift the submit button and change one label's text
        const drifted =
          screenId === 'login' && (el.id === 'login-submit' || el.id === 'login-subheader');
        return {
          ...el,
          bounds: drifted ? { ...el.bounds, y: el.bounds.y + 12 } : el.bounds,
          text: el.id === 'login-subheader' ? 'Sign in to your workspace' : el.text,
          locator: {
            css: `[data-screen="${screenId}"][data-el="${el.id}"]`,
            testId: `el-${el.id}`,
          },
          actual: { sampled: true },
        };
      }),
      interactions: [],
    };

    const base = renderSpecPng(impl);
    const buf = perturbPng(base, severity);
    const p = `${this.cfg.artifactsDir}/screens/${screenId}/impl.png`;
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, buf);

    return {
      spec: impl,
      screenshotPath: p,
      provider: 'sample',
      warnings: ['sample mode: simulated impl, not a live crawl'],
    };
  }
}
