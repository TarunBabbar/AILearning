import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Glassdoor Company Details Portal",
  description:
    "Categorized companies with star ratings, pros & cons from reviews, and consolidated salaries in LPA.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-sand/70 bg-cream/40">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold text-lg font-bold text-ink shadow-sm">
                G
              </span>
              <span className="leading-tight">
                <span className="block text-base font-bold text-coffee">
                  Company Details Portal
                </span>
                <span className="block text-xs text-mocha">
                  Glassdoor-powered insights
                </span>
              </span>
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>

        <footer className="border-t border-sand/70 bg-cream/30 py-6 text-center text-xs text-mocha">
          Consolidated from user reviews &amp; salary data · Sala₹ breakdowns shown in LPA (lakhs/year)
        </footer>
      </body>
    </html>
  );
}