"use client";

import { useState } from "react";
import { Loader2, Sparkles, FileText, Beaker } from "lucide-react";
import { cn } from "@/lib/utils";

type TestCase = {
  title: string;
  description: string;
  steps: { action: string; expected: string }[];
  priority: string;
  testType: string;
};

export default function TestArchitectPage() {
  const [prdText, setPrdText] = useState("");
  const [jiraKey, setJiraKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [error, setError] = useState("");

  const generateTests = async () => {
    if (!prdText.trim()) return;
    setLoading(true);
    setError("");
    setTestCases([]);
    try {
      const res = await fetch("/api/test-cases/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prdText: prdText.trim(), jiraKey: jiraKey.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTestCases(data.testCases || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    }
    setLoading(false);
  };

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-text-primary mb-2">Test Architect</h1>
      <p className="text-text-secondary mb-6">
        Paste PRD requirements to automatically generate structured test cases
      </p>

      {/* Input */}
      <div className="bg-white border border-border rounded-lg p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Beaker size={18} className="text-amber-500" />
          <h2 className="font-semibold text-text-primary">PRD / Requirements</h2>
        </div>
        <textarea
          value={prdText}
          onChange={(e) => setPrdText(e.target.value)}
          placeholder={`Paste your PRD or requirements here...\n\nExample:\nFeature: User Login\n- Users should be able to log in with email and password\n- System should validate credentials against the database\n- Failed attempts should show appropriate error messages\n- After 5 failed attempts, account should be locked for 15 minutes`}
          rows={8}
          className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:border-border-focus resize-y"
        />
        <div className="flex items-center gap-3 mt-3">
          <input
            type="text"
            value={jiraKey}
            onChange={(e) => setJiraKey(e.target.value)}
            placeholder="JIRA Key (optional): PRD-123"
            className="flex-1 px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:border-border-focus"
          />
          <button
            onClick={generateTests}
            disabled={!prdText.trim() || loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Generate Tests
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Results */}
      {testCases.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-text-primary flex items-center gap-2">
            <FileText size={18} className="text-amber-500" />
            Generated Test Cases ({testCases.length})
          </h2>
          {testCases.map((tc, i) => (
            <div key={i} className="bg-white border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-bg-surface border-b border-border flex items-center justify-between">
                <div>
                  <span className="text-xs text-text-muted mr-2">TC-{i + 1}</span>
                  <span className="font-medium text-text-primary">{tc.title}</span>
                </div>
                <div className="flex gap-2">
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    tc.priority === "high" ? "bg-red-100 text-red-700" :
                    tc.priority === "medium" ? "bg-amber-100 text-amber-700" :
                    "bg-green-100 text-green-700"
                  )}>
                    {tc.priority}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {tc.testType}
                  </span>
                </div>
              </div>
              {tc.description && (
                <div className="px-4 py-2 text-sm text-text-secondary border-b border-border">
                  {tc.description}
                </div>
              )}
              {tc.steps.length > 0 && (
                <div className="px-4 py-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-text-muted uppercase">
                        <th className="text-left py-1 pr-2">#</th>
                        <th className="text-left py-1 pr-2">Action</th>
                        <th className="text-left py-1">Expected Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tc.steps.map((step, j) => (
                        <tr key={j}>
                          <td className="py-1.5 pr-2 text-text-muted w-6">{j + 1}</td>
                          <td className="py-1.5 pr-2 text-text-secondary">{step.action}</td>
                          <td className="py-1.5 text-text-primary">{step.expected}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
