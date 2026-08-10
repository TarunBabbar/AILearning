import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f4ef] p-8 text-center">
      <h1 className="text-6xl font-semibold text-claude-accent">404</h1>
      <p className="mt-3 text-sm text-claude-muted">
        This page doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-claude-accent px-4 py-2 text-sm font-medium text-white hover:bg-claude-accent-strong"
      >
        Back to QA Jobs
      </Link>
    </div>
  );
}
