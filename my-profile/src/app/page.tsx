import type { Metadata } from "next";
import Hero from "@/components/Hero";
import HomeOverview from "@/components/HomeOverview";

export const metadata: Metadata = {
  title: "Tarun Kumar Babbar — AI QA Architect | 1st Place, AI Tester Blueprint 3x",
  description:
    "AI QA Architect and Test Automation Architect with 18+ years in quality engineering. Builder of multi-agent QA platforms and 10+ live AI apps, including the QAE2E hackathon winner.",
};

export default function Home() {
  return (
    <>
      <Hero />
      <HomeOverview />
    </>
  );
}
