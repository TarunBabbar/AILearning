import { FigmaMcp } from './figmaMcp.js';

export interface FigmaMaterial {
  file: string;
  designJson?: string;
  images: { fileName: string; imageUrl: string }[];
}

/**
 * Pulls the design artifacts the analysis agent needs from the Figma MCP
 * server. Two server generations are supported:
 *
 *  - modern `figma-developer-mcp` (Framelink): exposes `get_figma_data`
 *    (returns a simplified, serialized text summary of the file's layout,
 *    content, components and visuals) and `download_figma_images`.
 *  - older community servers: expose `get_file` / `get_image` (raw file JSON
 *    + rendered node URLs).
 *
 * We call whichever tool the connected server exposes. Image render downloads
 * are best-effort and skipped when the exposed tool set doesn't trivially
 * support them — the serialized text from `get_figma_data` is enough for the
 * analysis agent to work from.
 */
export async function fetchFigmaMaterial(
  figma: FigmaMcp,
  fileKey: string,
  seriesLabels: string[],
  imagesOutDir: string,
): Promise<{ material: FigmaMaterial; nodesJson: string }> {
  const tools = figma.toolList();

  let designJson: string;
  if (tools.includes('get_figma_data')) {
    designJson = String(
      await figma.call('get_figma_data', { fileKey }) ?? '',
    );
  } else if (tools.includes('get_file')) {
    designJson = String(await figma.call('get_file', { file_key: fileKey }) ?? '');
  } else {
    throw new Error(
      `Figma MCP server exposes none of the expected read tools (get_figma_data, get_file). ` +
        `Connected server tools: ${tools.join(', ') || '(none)'}. ` +
        `Use the "figma-developer-mcp" server (see README).`,
    );
  }

  // Image renders are optional; only attempt when a render/download tool
  // exists AND the caller asked for specific design series.
  const images: { fileName: string; imageUrl: string }[] = [];
  if (seriesLabels.length > 0 && tools.includes('download_figma_images')) {
    console.warn(
      '[figma] The connected server downloads images per-node via `download_figma_images`, which needs per-node imageRefs from the data output. Image renders were skipped; the analysis agent will work from the serialized design data.',
    );
  } else if (seriesLabels.length > 0 && tools.includes('get_image')) {
    // Legacy fallback: render frames by name is unreliable (get_image wants
    // node ids, not names). Skip rather than guess.
    console.warn('[figma] Image rendering for this server requires node ids; skipping renders.');
  }

  return { material: { file: fileKey, designJson, images }, nodesJson: designJson };
}