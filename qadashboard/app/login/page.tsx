"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LogIn, Loader2, Bug } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-page">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-amber-500 flex items-center justify-center mx-auto mb-4">
            <Bug size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">QA AI Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">Sign in to your account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-amber-500/20"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:border-border-focus focus:ring-1 focus:ring-amber-500/20"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!username || !password || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            Sign In
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-text-muted">New here?</span></div>
          </div>

          <Link
            href="/register"
            className="block w-full text-center text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            Create an account &rarr;
          </Link>
        </form>
      </div>
    </div>
  );
}
