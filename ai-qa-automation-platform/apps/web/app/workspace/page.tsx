import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function WorkspaceHome() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div>
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <p className="mt-1 text-sm text-slate-500">
        Welcome back, {session.user?.name || session.user?.email}
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Connect sources" desc="GitHub, Jira, and your database — the platform reads them via MCP." href="/workspace/connections" />
        <Card title="Review generated tests" desc="Approve, edit, or reject AI-drafted cases." href="/workspace/review" />
        <Card title="Run suites & gate releases" desc="Execute approved cases, score with DeepEval, get a gate verdict." href="/workspace/runs" />
      </div>
    </div>
  );
}

function Card({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <a href={href} className="block rounded-xl border bg-white p-6 shadow-sm transition hover:border-brand-500">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </a>
  );
}
