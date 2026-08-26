import type { SalaryRow } from "@/lib/types";

export default function SalaryTable({ salaries }: { salaries: SalaryRow[] }) {
  if (!salaries || salaries.length === 0) {
    return (
      <p className="text-sm text-mocha">No salary data available yet.</p>
    );
  }

  const sorted = [...salaries].sort((a, b) => b.avgLPA - a.avgLPA);
  const maxAvg = Math.max(...sorted.map((s) => s.avgLPA), 1);

  return (
    <div className="overflow-hidden rounded-xl border border-sand/70 bg-white/50">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-sand/70 bg-cream/50 text-xs uppercase tracking-wide text-mocha">
            <th className="px-4 py-2.5 font-semibold">Designation</th>
            <th className="px-4 py-2.5 font-semibold">Avg Salary</th>
            <th className="px-4 py-2.5 font-semibold">Range</th>
            <th className="px-4 py-2.5 text-right font-semibold">Sample</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr key={i} className="border-b border-sand/40 last:border-0">
              <td className="px-4 py-3 font-medium text-coffee">{s.designation}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="w-16 font-bold text-ink">₹{s.avgLPA} LPA</span>
                  <div className="h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-sand/50">
                    <div
                      className="h-full rounded-full bg-gold"
                      style={{ width: `${(s.avgLPA / maxAvg) * 100}%` }}
                    />
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-mocha">₹{s.rangeLPA} LPA</td>
              <td className="px-4 py-3 text-right text-xs text-mocha">
                {s.sampleSize != null ? `${s.sampleSize} reviews` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}