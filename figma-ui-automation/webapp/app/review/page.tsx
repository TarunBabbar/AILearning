'use client';

import { useCallback, useEffect, useState } from 'react';

interface TestCaseItem {
  id: string;
  title: string;
  feature: string;
  scenario: string;
  priority: string;
  source: string;
  review?: string;
  reviewNote?: string;
  steps: Array<{ action: string; target?: string; value?: string }>;
  expected: string;
}

interface TestCaseFile {
  screenId: string;
  designVersion: string;
  provider: string;
  generatedAt: string;
  cases: TestCaseItem[];
}

const REVIEW_STYLES: Record<string, string> = {
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
};

export default function ReviewPage() {
  const [files, setFiles] = useState<TestCaseFile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    fetch('/api/testcases')
      .then((r) => r.json())
      .then((d) => setFiles(d))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function decide(screenId: string, decision: 'approved' | 'rejected', caseId?: string) {
    await fetch('/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenId, decision, ...(caseId ? { caseId } : { all: true }) }),
    });
    refresh();
  }

  const badge = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium border';

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1f2933] mb-1">Test Review</h1>
      <p className="text-[13px] text-[#52606d] mb-6">Approve or reject generated test cases before they become Playwright code.</p>

      {loading ? (
        <div className="text-[#52606d] text-sm">Loading…</div>
      ) : files.length === 0 ? (
        <div className="bg-white border border-[#ede3da] rounded-xl p-8 text-center text-[#52606d] text-sm">
          No test cases yet. Run <span className="mono">Shift-Left</span> to generate them.
        </div>
      ) : (
        files.map((f) => {
          const approved = f.cases.filter((c) => c.review === 'approved').length;
          return (
            <div key={f.screenId} className="mb-6 bg-white border border-[#ede3da] rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-[#faf7f5] border-b border-[#ede3da] flex items-center justify-between">
                <div>
                  <span className="font-semibold text-[14px] text-[#1f2933]">{f.screenId}</span>
                  <span className="ml-3 text-[11px] text-[#9aa5b1] mono">{f.provider} · v{f.designVersion}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11.5px] text-[#52606d]">{approved}/{f.cases.length} approved</span>
                  <button
                    onClick={() => decide(f.screenId, 'approved')}
                    disabled={approved === f.cases.length}
                    className="rounded-md bg-amber-700 hover:bg-amber-800 disabled:opacity-40 text-white text-[12px] font-medium px-3 py-1.5"
                  >
                    Approve all
                  </button>
                </div>
              </div>

              <div className="divide-y divide-[#f0eae2]">
                {f.cases.map((c) => (
                  <div key={c.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`${badge} ${REVIEW_STYLES[c.review ?? 'pending']}`}>{c.review ?? 'pending'}</span>
                        <span className="mono text-[11px] text-[#9aa5b1]">{c.id}</span>
                        <span className={`text-[10.5px] font-semibold ${c.priority === 'P0' ? 'text-red-600' : 'text-[#52606d]'}`}>{c.priority}</span>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {c.review !== 'approved' && (
                          <button onClick={() => decide(f.screenId, 'approved', c.id)} className="text-[11.5px] text-green-700 hover:text-green-800 font-medium">
                            Approve
                          </button>
                        )}
                        {c.review !== 'rejected' && (
                          <button onClick={() => decide(f.screenId, 'rejected', c.id)} className="text-[11.5px] text-red-600 hover:text-red-700 font-medium">
                            Reject
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-[13px] font-medium text-[#1f2933]">{c.title}</div>
                    <div className="text-[12px] text-[#52606d] mt-0.5">{c.scenario}</div>
                    {c.steps.length > 0 && (
                      <div className="mt-1.5 mono text-[11px] text-[#3e4c59] space-y-0.5">
                        {c.steps.map((s, i) => (
                          <div key={i}>
                            · {s.action} {s.target ?? ''} {s.value ? `= "${s.value}"` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 text-[11.5px] text-[#52606d]">
                      <span className="text-[#9aa5b1]">Expect:</span> {c.expected}
                    </div>
                    {c.reviewNote && <div className="mt-1 text-[11px] text-[#b45309]">Note: {c.reviewNote}</div>}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
