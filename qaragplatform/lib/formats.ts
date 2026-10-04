/**
 * The single source of truth for what an upload may be.
 *
 * Kept free of any Node imports so the upload UI can import it too (the
 * extraction module deliberately requires native parsers, which must not end
 * up in the client bundle).
 */

export const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'html', 'htm', 'xml', 'yml', 'yaml', 'log', 'rtf',
])

export const BINARY_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'xls'])

export const SUPPORTED_EXTENSIONS = [...BINARY_EXTENSIONS, ...TEXT_EXTENSIONS].sort()

/** For the <input accept="…"> attribute. */
export const ACCEPT_ATTR = SUPPORTED_EXTENSIONS.map((e) => `.${e}`).join(',')

export function extensionOf(name: string): string {
  return (name.split('.').pop() || '').toLowerCase()
}

export function isSupported(name: string): boolean {
  return SUPPORTED_EXTENSIONS.includes(extensionOf(name))
}

export const SUPPORTED_LABEL =
  'PDF, DOCX, XLSX/XLS, CSV, or text (TXT, MD, JSON, HTML, XML, YAML)'
