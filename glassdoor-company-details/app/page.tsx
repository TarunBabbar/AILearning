import type { Metadata } from "next";
import { getCompanies } from "@/lib/data";
import CompanyList from "@/components/CompanyList";

export const metadata: Metadata = {
  title: "Companies — Glassdoor Company Details Portal",
};

export default async function HomePage() {
  const companies = await getCompanies();

  return (
    <>
      <section className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-coffee sm:text-4xl">
          Company Details Portal
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-mocha">
          Explore companies categorized by type, see star ratings from employees
          who have worked there, read concise <b>good</b> vs <b>bad</b> insights,
          and check consolidated salaries per designation (in ₹ LPA).
        </p>
      </section>

      <CompanyList companies={companies} />
    </>
  );
}