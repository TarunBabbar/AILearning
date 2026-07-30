import Hero from "@/components/Hero";
import About from "@/components/About";
import CurrentlyBuilding from "@/components/CurrentlyBuilding";
import Projects from "@/components/Projects";
import Skills from "@/components/Skills";
import Career from "@/components/Career";
import Education from "@/components/Education";
import Contact from "@/components/Contact";

export default function Home() {
  return (
    <>
      <Hero />
      <About />
      <CurrentlyBuilding />
      <Projects />
      <Skills />
      <Career />
      <Education />
      <Contact />

      <footer className="text-center py-8 text-sm text-text-muted border-t border-border">
        <div className="max-w-5xl mx-auto px-6">
          Tarun Kumar Babbar — AI QA Architect | Test Automation Architect
        </div>
      </footer>
    </>
  );
}
