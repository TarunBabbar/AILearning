import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { FlowSteps } from "@/components/landing/FlowSteps";
import { AgentCards } from "@/components/landing/AgentCards";
import { Integrations } from "@/components/landing/Integrations";
import { CtaPanel } from "@/components/landing/CtaPanel";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <FlowSteps />
        <AgentCards />
        <Integrations />
        <CtaPanel />
      </main>
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-text-muted">
          <p>QAE2E — Agentic Quality Engineering.</p>
          <p>From Requirement to Release Confidence.</p>
        </div>
      </footer>
    </div>
  );
}
