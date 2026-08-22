import { OpenRouterClient } from '../llm/openrouter.js';
import { DesignAnalysis, isJsonObject } from './schema.js';
import { FigmaMaterial } from '../figma/loader.js';

/**
 * Agent 1 — Design Analysis.
 * Reads the Figma design JSON (and the rendered image URLs) and turns it into
 * a structured description the test-case agent can act on.
 */
export class AnalysisAgent {
  constructor(private readonly llm: OpenRouterClient, private readonly modelName: string) {}

  async analyze(material: FigmaMaterial): Promise<DesignAnalysis> {
    const userPrompt = [
      'Analyze the following Figma design file for a UI feature.',
      '',
      '## File metadata',
      `File key: ${material.file}`,
      '',
      '## Rendered frame images (reference visually if readable)',
      material.images.map((i) => `- ${i.fileName}: ${i.imageUrl}`).join('\n') || '- none',
      '',
      '## Design data (layout, content, components, visuals)',
      material.designJson?.slice(0, 60_000) ?? '(no design data provided)',
      '',
      '## Preview images',
      material.images.length
        ? material.images.map((i) => `![${i.fileName}](${i.imageUrl})`).join('\n')
        : '(none)',
      '',
      '## What to produce',
      'Return ONLY a single JSON object (no markdown fences, no commentary) with this shape:',
      JSON.stringify(
        {
          productName: 'short product name',
          purpose: 'one paragraph describing what the design covers',
          pages: [{ name: 'page/screen name', description: 'what it contains' }],
          keyElements: [
            { name: 'element name', type: 'button|input|dropdown|checkbox|link|card|table|text...', notes: 'props/labels visible in design' },
          ],
          interactions: [
            'user-facing behaviors discoverable from the design, e.g. "submitting a valid form navigates to success"',
          ],
        },
        null,
        2,
      ),
    ].join('\n');

    const system = [
      'You are a senior product analyst converting a Figma UI design into a precise, structured UX analysis.',
      'Extract only what is actually present in the design JSON and images.',
      'For every visual element that is interactive (button, input, link, menu), capture its label and behavior.',
      'Call out forms and their fields, validation states, empty states, and any error/success messaging found.',
      'Do not invent functionality that is not present.',
      'Emit strictly valid JSON with the exact shape requested.',
    ].join('\n');

    const result = await this.llm.chat(system, userPrompt, { temperature: 0.1 });
    return this.parse(result.content);
  }

  private parse(raw: string): DesignAnalysis {
    const obj = extractJson(raw);
    if (!isJsonObject(obj)) throw new Error('Analysis agent did not return a JSON object.');
    return {
      productName: String(obj.productName ?? 'Untitled product'),
      purpose: String(obj.purpose ?? ''),
      pages: Array.isArray(obj.pages) ? obj.pages.map((p) => p as DesignAnalysis['pages'][number]) : [],
      keyElements: Array.isArray(obj.keyElements)
        ? obj.keyElements.map((e) => {
            const o = isJsonObject(e) ? e : {};
            return {
              name: String(o.name ?? ''),
              type: String(o.type ?? 'unknown'),
              notes: String(o.notes ?? ''),
            };
          })
        : [],
      interactions: Array.isArray(obj.interactions) ? obj.interactions.map(String) : [],
    };
  }
}

/** Pull the first JSON object out of a raw model reply (handles stray prose/fences). */
export function extractJson(raw: string): unknown {
  const stripped = raw.replace(/```(?:json)?/g, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model output.');
  }
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    throw new Error('Model output contained invalid JSON.');
  }
}