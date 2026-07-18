export interface DocumentSummary {
  fileName: string
  fileType: string
  totalRows: number
  columns: string[]
  columnDistributions: Record<string, { value: string; count: number }[]>
  text: string  // Full summary text for embedding/indexing
}

export function summarizeContent(
  fileName: string,
  content: string,
  fileType: string
): DocumentSummary | null {
  const ext = fileName.split('.').pop()?.toLowerCase()

  if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
    return summarizeTabular(fileName, content, fileType, ext)
  }

  // For plain text/docs: count lines, words, characters
  const lines = content.split('\n').filter(l => l.trim()).length
  const words = content.split(/\s+/).length
  const summaryText =
    `File: ${fileName}\n` +
    `Type: Plain text\n` +
    `Total lines: ${lines}\n` +
    `Total words: ${words}\n` +
    `Total characters: ${content.length}`

  return {
    fileName,
    fileType,
    totalRows: lines,
    columns: [],
    columnDistributions: {},
    text: summaryText,
  }
}

function summarizeTabular(
  fileName: string,
  content: string,
  fileType: string,
  ext: string
): DocumentSummary | null {
  const lines = content.split('\n').filter(l => l.trim())
  if (lines.length < 2) return null

  // First line is header (for CSVs converted from Excel, first line has column names)
  const headerLine = lines[0]
  const columns = parseLine(headerLine)
  const dataLines = lines.slice(1).filter(l => l.trim())

  const totalRows = dataLines.length
  if (totalRows === 0) return null

  // Build value distributions for each column (up to 20 most frequent values)
  const columnDistributions: Record<string, { value: string; count: number }[]> = {}

  for (let ci = 0; ci < columns.length; ci++) {
    const colName = columns[ci] || `Column${ci + 1}`
    const freq = new Map<string, number>()

    for (const line of dataLines) {
      const values = parseLine(line)
      const val = (values[ci] || '').trim()
      if (val) {
        freq.set(val, (freq.get(val) || 0) + 1)
      }
    }

    // Sort by count descending, take top 20
    columnDistributions[colName] = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([value, count]) => ({ value, count }))
  }

  // Build readable summary text
  const parts: string[] = [
    `--- Document Summary ---`,
    `File: ${fileName}`,
    `Type: ${ext.toUpperCase()} (${fileType})`,
    `Total data rows: ${totalRows}`,
    `Columns (${columns.length}): ${columns.join(', ')}`,
    ``,
    `Column value distribution:`,
  ]

  for (const col of columns) {
    const dist = columnDistributions[col] || []
    if (dist.length === 0) continue
    const topValues = dist.slice(0, 10).map(d => `${d.value}: ${d.count}`).join(', ')
    parts.push(`  ${col}: ${topValues}${dist.length > 10 ? ` (and ${dist.length - 10} more values)` : ''}`)
  }

  const text = parts.join('\n')

  return {
    fileName,
    fileType,
    totalRows,
    columns,
    columnDistributions,
    text,
  }
}

function parseLine(line: string): string[] {
  // Simple CSV line parser (handles quoted values)
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}
