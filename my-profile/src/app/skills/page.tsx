import type { Metadata } from "next";
import Skills from "@/components/Skills";
import ExploreNav from "@/components/ExploreNav";

export const metadata: Metadata = {
  title: "Skills — Tarun Kumar Babbar | AI & Test Automation",
  description:
    "AI & agentic QA, test automation, platforms, languages, vector databases and framework architecture — Playwright, TypeScript, DeepEval, RAG, Azure DevOps and more.",
};

export default function SkillsPage() {
  return (
    <>
      <Skills />
      <ExploreNav />
    </>
  );
}
