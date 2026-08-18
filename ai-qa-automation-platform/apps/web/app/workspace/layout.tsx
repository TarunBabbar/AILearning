import Link from "next/link";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const nav = [
    { href: "/workspace", label: "Dashboard" },
    { href: "/workspace/generate", label: "Generate Tests" },
    { href: "/workspace/connections", label: "Connections" },
    { href: "/workspace/review", label: "Review Queue" },
    { href: "/workspace/runs", label: "Runs" },
    { href: "/workspace/settings", label: "Settings" },
  ];
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-white p-4">
        <h1 className="text-lg font-bold text-brand-600">QA Platform</h1>
        <nav className="mt-6 flex flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
