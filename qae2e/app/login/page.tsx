"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Login failed");
        setLoading(false);
        return;
      }
      router.push("/workspaces");
      router.refresh();
    } catch {
      setError("Network error — try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500 text-white">
            <Sparkles size={16} />
          </span>
          <span className="text-lg font-bold text-text-primary">QAE2E</span>
        </div>
        <Card className="p-6">
          <h1 className="text-xl font-bold text-text-primary">Sign in</h1>
          <p className="mt-1 text-sm text-text-secondary">Welcome back — continue your QA workspace.</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-text-secondary">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-text-secondary">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="mt-1 w-full rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
              />
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-text-muted">
          No account?{" "}
          <Link href="/signup" className="font-semibold text-amber-700 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
