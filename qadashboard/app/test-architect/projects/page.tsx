"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2, Plus } from "lucide-react";

type Project = {
  id: string;
  name: string;
  description: string | null;
  jiraUrl: string | null;
  createdAt: string;
  testCases: number;
};

export default function TestProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [jiraUrl, setJiraUrl] = useState("");

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  const createProject = async () => {
    if (!name.trim()) return;
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc, jiraUrl }),
      });
      setName(""); setDesc(""); setJiraUrl(""); setShowNew(false);
      fetchProjects();
    } catch {}
  };

  const deleteProject = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {}
  };

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Projects</h1>
          <p className="text-sm text-text-muted">Manage test analysis projects</p>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600"
        >
          <Plus size={16} />
          New Project
        </button>
      </div>

      {showNew && (
        <div className="bg-white border border-border rounded-lg p-4 mb-4 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:border-border-focus"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:border-border-focus resize-none"
          />
          <input
            value={jiraUrl}
            onChange={(e) => setJiraUrl(e.target.value)}
            placeholder="JIRA URL (optional)"
            className="w-full px-3 py-2 border border-border-input rounded-lg text-sm bg-bg-input focus:outline-none focus:border-border-focus"
          />
          <button onClick={createProject} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600">
            Create
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-text-muted" /></div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm bg-white border border-border rounded-lg">
          No projects. Create one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <div key={p.id} className="bg-white border border-border rounded-lg p-4 flex items-center justify-between hover:bg-bg-surface transition-colors">
              <div>
                <p className="font-medium text-text-primary">{p.name}</p>
                <p className="text-xs text-text-muted">
                  {p.testCases} test cases · Created {new Date(p.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => deleteProject(p.id)} className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
