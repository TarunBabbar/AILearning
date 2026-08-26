import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCompanies, getCompanyBySlug } from "@/lib/data";
import StarRating from "@/components/StarRating";
import TypeBadge from "@/components/TypeBadge";
import ProsCons from "@/components/ProsCons";
import SalaryTable from "@/components/SalaryTable";
import ReAnalyzeButton from "@/components/ReAnalyzeButton";

export async function generateStaticParams() {
  const companies = await getCompanies();
  return companies.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  return { title: company ? `${company.name} — Company Portal` : "Company" };
}

const BREAKDOWN_LABELS: Record<string, string> = {
  career: "Career Prospects",
  comp: "Compensation",
  management: "Management",
  culture: "Culture",
};

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  return (
    <article className="max-w-4xl">
      <nav className="mb-4 text-sm text-mocha">
        <a href="/" className="hover:text-gold-deep">← Back to companies</a>
      </nav>

      <header className="mb-6 rounded-2xl border border-sand/70 bg-white/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-coffee">
                {company.name}
              </h1>
              <TypeBadge type={company.type} />
            </div>
            <p className="mt-1 text-mocha">{company.industry}</p>
          </div>
          <div className="text-right">
            <StarRating rating={company.rating} size={26} />
            {company.totalReviews != null && (
              <p className="mt-1 text-xs text-mocha">
                {company.totalReviews.toLocaleString()} reviews on Glassdoor
              </p>
            )}
          </div>
        </div>

        {company.headcount && (
          <div className="mt-4 flex flex-wrap gap-6 border-t border-sand/60 pt-4 text-sm text-mocha">
            <span>
              India headcount: <b className="text-coffee">{company.headcount.india}</b>
            </span>
            <span>
              Global headcount: <b className="text-coffee">{company.headcount.global}</b>
            </span>
            {company.sourceReviews != null && (
              <span>
                Analyzed sample: <b className="text-coffee">{company.sourceReviews} reviews</b>
              </span>
            )}
          </div>
        )}

        {company.ratingBreakdown &&
          Object.keys(company.ratingBreakdown).length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(company.ratingBreakdown).map(([key, val]) => (
                <div
                  key={key}
                  className="rounded-lg bg-cream/50 px-3 py-2 text-center"
                >
                  <div className="text-xs uppercase tracking-wide text-mocha">
                    {BREAKDOWN_LABELS[key] ?? key}
                  </div>
                  <div className="text-lg font-bold text-gold-deep">{val?.toFixed(1)}</div>
                </div>
              ))}
            </div>
          )}
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-coffee">Pros &amp; Cons</h2>
        <ProsCons good={company.good} bad={company.bad} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-bold text-coffee">
          Salaries by Designation <span className="text-sm font-normal text-mocha">(₹ LPA)</span>
        </h2>
        <SalaryTable salaries={company.salaries} />
      </section>

      <section className="rounded-xl border border-dashed border-taupe/50 bg-cream/30 p-4">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-mocha">
          Refresh insights
        </h3>
        <p className="mb-3 text-sm text-mocha">
          Run the LLM again on this company&apos;s latest scraped reviews to update
          the pros/cons and salary averages.
        </p>
        <ReAnalyzeButton slug={company.slug} />
      </section>
    </article>
  );
}