"use client";

import { useMemo, useState } from "react";
import type { Company } from "@/lib/types";
import CompanyCard from "@/components/CompanyCard";

export default function CompanyList({ companies }: { companies: Company[] }) {
  const types = Array.from(new Set(companies.map((c) => c.type))).sort();
  const [active, setActive] = useState<string>("All");

  const filtered = useMemo(
    () =>
      active === "All"
        ? companies
        : companies.filter((c) => c.type === active),
    [companies, active]
  );

  if (companies.length === 0) {
    return (
      <p className="mt-8 text-mocha">
        No companies loaded yet. Run <code className="rounded bg-cream px-1.5 py-0.5 text-coffee">npm run analyze</code>{" "}
        (or <code className="rounded bg-cream px-1.5 py-0.5 text-coffee">npm run scrape</code>) to generate the dataset.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-6 flex flex-wrap gap-2">
        {["All", ...types].map((t) => {
          const count =
            t === "All"
              ? companies.length
              : companies.filter((c) => c.type === t).length;
          const isActive = active === t;
          return (
            <button
              key={t}
              onClick={() => setActive(t)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "border-gold-deep bg-gold text-white shadow-sm"
                  : "border-sand/70 bg-white/50 text-mocha hover:border-taupe hover:text-coffee"
              }`}
            >
              {t}
              <span
                className={`ml-1.5 text-xs ${isActive ? "text-white/80" : "text-mocha"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((company) => (
          <CompanyCard key={company.slug} company={company} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-8 text-mocha">No {active} companies to show.</p>
      )}
    </div>
  );
}