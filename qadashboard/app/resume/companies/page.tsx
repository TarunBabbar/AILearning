"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => {
        const jobs = data.jobs || [];
        // Aggregate unique companies
        const map = new Map<string, { count: number; maxScore: number; locations: Set<string> }>();
        jobs.forEach((j: any) => {
          if (!j.company || j.company === "Unknown Company") return;
          if (!map.has(j.company)) map.set(j.company, { count: 0, maxScore: 0, locations: new Set() });
          const entry = map.get(j.company)!;
          entry.count++;
          entry.maxScore = Math.max(entry.maxScore, j.score || 0);
          if (j.location) entry.locations.add(j.location);
        });
        setCompanies(
          Array.from(map.entries()).map(([name, data]) => ({
            name,
            count: data.count,
            maxScore: data.maxScore,
            locations: Array.from(data.locations),
          }))
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-text-primary mb-2">Companies</h1>
      <p className="text-text-secondary mb-6">Companies extracted from job listings</p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-text-muted" /></div>
      ) : companies.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm">No companies found. Upload job PDFs first.</div>
      ) : (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-surface">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-text-primary">Company</th>
                <th className="text-left px-4 py-3 font-medium text-text-primary">Jobs</th>
                <th className="text-left px-4 py-3 font-medium text-text-primary">Best Score</th>
                <th className="text-left px-4 py-3 font-medium text-text-primary">Locations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {companies.map((c) => (
                <tr key={c.name} className="hover:bg-bg-surface">
                  <td className="px-4 py-3 font-medium text-text-primary">{c.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.count}</td>
                  <td className="px-4 py-3">
                    <span className={c.maxScore >= 60 ? "text-green-600 font-medium" : "text-text-secondary"}>
                      {c.maxScore || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{c.locations.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
