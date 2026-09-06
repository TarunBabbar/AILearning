import Hero from "@/components/Hero";
import Header from "@/components/Header";
import About from "@/components/About";
import Projects from "@/components/Projects";
import Skills from "@/components/Skills";
import Career from "@/components/Career";
import Education from "@/components/Education";
import Contact from "@/components/Contact";

export default function Home() {
  return (
    <>
      <Header />
      <Hero />
      <About />
      <Projects />
      <Skills />
      <Career />
      <Education />
      <Contact />

      <footer className="text-center py-10 text-sm text-text-muted border-t border-border bg-bg-card">
        <div className="max-w-6xl mx-auto px-6">
          <p className="font-semibold text-text">
            Tarun Kumar Babbar — AI QA Architect | Test Automation Architect
          </p>
          <p className="mt-2 text-xs">
            🏆 1st Place — AI Tester Blueprint 3x Hackathon · © {new Date().getFullYear()} Tarun
            Kumar Babbar
          </p>
        </div>
      </footer>
    </>
  );
}
