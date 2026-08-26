import { writeText } from '../../shared/lib/fs.ts';
import type { DriftReport } from './agent.ts';

const SEV_COLORS: Record<string, string> = {
  info: '#6b7280',
  minor: '#b45309',
  major: '#dc2626',
  critical: '#7f1d1d',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Renders a self-contained HTML drift report (no external assets). */
export function renderDriftHtml(report: DriftReport, opts: { designPng?: string; implPng?: string; diffPng?: string } = {}): string {
  const rows = report.deltas
    .map(
      (d) => `
      <tr>
        <td><span class="sev" style="background:${SEV_COLORS[d.severity]}">${d.severity}</span></td>
        <td>${esc(d.type)}</td>
        <td>${esc(d.elementName)}</td>
        <td>${esc(d.detail)}</td>
        <td class="mono">${esc(String(d.expected ?? ''))}</td>
        <td class="mono">${esc(String(d.actual ?? ''))}</td>
      </tr>`,
    )
    .join('');

  const images = [
    ...(opts.designPng ? [`<div class="shot"><h3>Design (Figma)</h3><img src="${opts.designPng}"/></div>`] : []),
    ...(opts.implPng ? [`<div class="shot"><h3>Implementation</h3><img src="${opts.implPng}"/></div>`] : []),
    ...(opts.diffPng ? [`<div class="shot"><h3>Pixel diff</h3><img src="${opts.diffPng}"/></div>`] : []),
  ].join('');

  const judgment = report.judgment
    ? `<div class="card"><h2>LLM Vision Judgment</h2>
       <p><strong>Verdict:</strong> <span class="verdict ${report.judgment.verdict}">${report.judgment.verdict}</span> <small>(${esc(report.judgment.provider)})</small></p>
       <p>${esc(report.judgment.summary)}</p>
       <ul>${report.judgment.issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Drift Report — ${esc(report.screenId)}</title>
<style>
  body{font-family:system-ui,sans-serif;background:#faf7f5;color:#1f2933;margin:0;padding:24px}
  h1{font-size:22px} h2{font-size:16px;margin-top:0}
  .wrap{max-width:1100px;margin:0 auto}
  .card{background:#fff;border:1px solid #ede3da;border-radius:10px;padding:16px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:8px;border-bottom:1px solid #eee;vertical-align:top}
  th{background:#f7f3ef}
  .sev{color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;text-transform:uppercase}
  .mono{font-family:monospace;font-size:12px}
  .stats{display:flex;gap:12px;flex-wrap:wrap}
  .stat{background:#f7f3ef;border:1px solid #ede3da;border-radius:8px;padding:8px 14px;text-align:center}
  .stat b{display:block;font-size:20px}
  .verdict{font-weight:700;text-transform:uppercase}
  .verdict.match{color:#0f9d58}.verdict.drift{color:#b45309}.verdict.critical-drift{color:#dc2626}
  .shots{display:flex;gap:16px;flex-wrap:wrap}
  .shot{flex:1;min-width:280px}
  .shot img{width:100%;border:1px solid #eee;border-radius:8px}
</style>
</head>
<body>
<div class="wrap">
  <h1>Drift Report — ${esc(report.screenId)}</h1>
  <p>Design version: <strong>${esc(report.designVersion)}</strong> · Generated: ${esc(report.createdAt)}</p>
  <div class="card">
    <h2>Summary</h2>
    <div class="stats">
      <div class="stat"><b>${report.summary.totalDeltas}</b>deltas</div>
      <div class="stat"><b>${report.summary.critical}</b>critical</div>
      <div class="stat"><b>${report.summary.major}</b>major</div>
      <div class="stat"><b>${report.summary.minor}</b>minor</div>
      <div class="stat"><b>${(report.summary.pixelDiffRatio * 100).toFixed(2)}%</b>pixel diff</div>
      <div class="stat"><b>${report.summary.verdict}</b>verdict</div>
    </div>
  </div>
  ${judgment}
  <div class="card">
    <h2>Delta details</h2>
    <table>
      <thead><tr><th>Severity</th><th>Type</th><th>Element</th><th>Detail</th><th>Expected</th><th>Actual</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">No deltas — design and implementation match.</td></tr>'}</tbody>
    </table>
  </div>
  ${images ? `<div class="card"><h2>Screenshots</h2><div class="shots">${images}</div></div>` : ''}
</div>
</body>
</html>`;
}

export function saveDriftReport(cfg: { reportsDir: string }, report: DriftReport): string {
  const p = `${cfg.reportsDir}/drift/${report.screenId}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.html`;
  writeText(p, renderDriftHtml(report));
  return p;
}
