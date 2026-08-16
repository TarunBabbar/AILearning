import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { FlowSteps } from "@/components/landing/FlowSteps";
import { AgentCards } from "@/components/landing/AgentCards";
import { Integrations } from "@/components/landing/Integrations";
import { CtaPanel } from "@/components/landing/CtaPanel";
import { AppFooter } from "@/components/ui/AppFooter";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <FlowSteps />
        <AgentCards />
        <Integrations />
        <CtaPanel />
      </main>
      <AppFooter />
    </div>
  );
}
