// Export layer: generate CSV or XLSX from coverage (test cases) for download.

import * as XLSX from "xlsx";
import type { Coverage, ExportFormat } from "../types";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toRows(coverage: Coverage): string[][] {
  const header = [
    "Case ID",
    "Title",
    "Description",
    "Priority",
    "Test Type",
    "Scenario Type",
    "Step #",
    "Action",
    "Expected Result",
  ];
  const rows: string[][] = [header];
  for (const tc of coverage.testCases) {
    if (!tc.steps.length) {
      rows.push([tc.id, tc.title, tc.description || "", tc.priority, tc.testType, tc.scenarioType || "", "", "", ""]);
    } else {
      tc.steps.forEach((s, i) => {
        rows.push([
          tc.id,
          i === 0 ? tc.title : "",
          i === 0 ? tc.description || "" : "",
          i === 0 ? tc.priority : "",
          i === 0 ? tc.testType : "",
          i === 0 ? tc.scenarioType || "" : "",
          String(i + 1),
          s.action,
          s.expected,
        ]);
      });
    }
  }
  return rows;
}

export function coverageToCsv(coverage: Coverage): string {
  return toRows(coverage)
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}

export function coverageToXlsx(coverage: Coverage): Buffer {
  const rows = toRows(coverage);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 10 }, { wch: 30 }, { wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
    { wch: 8 }, { wch: 40 }, { wch: 40 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Test Cases");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function fileName(coverage: Coverage, format: ExportFormat): string {
  const base = (coverage.module || coverage.product || "coverage").replace(/[^a-z0-9-_]/gi, "_").toLowerCase();
  return `${base}-test-cases.${format}`;
}
