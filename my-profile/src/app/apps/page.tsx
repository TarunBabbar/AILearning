import type { Metadata } from "next";
import Projects from "@/components/Projects";
import ExploreNav from "@/components/ExploreNav";

export const metadata: Metadata = {
  title: "AI Apps — Tarun Kumar Babbar | Live AI QA Applications",
  description:
    "10+ live AI applications: QAE2E (1st place, AI Tester Blueprint 3x), QABuddy RAG assistant, QA Jobs Portal, QA AI Dashboard, RAG platforms and Playwright frameworks.",
};

export default function AppsPage() {
  return (
    <>
      <Projects />
      <ExploreNav />
    </>
  );
}
