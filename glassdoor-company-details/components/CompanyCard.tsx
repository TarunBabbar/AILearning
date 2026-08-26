import Link from "next/link";
import type { Company } from "@/lib/types";
import StarRating from "@/components/StarRating";
import TypeBadge from "@/components/TypeBadge";

export default function CompanyCard({ company }: { company: Company }) {
  return (
    <Link
      href={`/companies/${company.slug}`}
      className="group flex flex-col gap-3 rounded-2xl border border-sand/70 bg-white/55 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:border-taupe/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-coffee group-hover:text-gold-deep">
            {company.name}
          </h3>
          <p className="text-sm text-mocha">{company.industry}</p>
        </div>
        <TypeBadge type={company.type} />
      </div>

      <div className="flex items-center gap-3">
        <StarRating rating={company.rating} size={18} />
        {company.totalReviews != null && (
          <span className="text-xs text-mocha">
            {company.totalReviews.toLocaleString()} reviews
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-mocha">
        {company.headcount && (
          <span title="Headcount">
            👥 India <b className="text-coffee">{company.headcount.india}</b>
            {" · "}Global <b className="text-coffee">{company.headcount.global}</b>
          </span>
        )}
        {company.salaries.length > 0 && (
          <span>
            💰 Top role avg{" "}
            <b className="text-coffee">
              ₹{company.salaries[0].avgLPA} LPA
            </b>
          </span>
        )}
      </div>
    </Link>
  );
}