import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-page p-8 text-center">
      <div className="text-5xl font-semibold text-amber-600">404</div>
      <p className="mt-3 text-sm text-text-muted">This page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
