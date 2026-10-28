import type { Metadata } from "next";
import About from "@/components/About";
import Education from "@/components/Education";

export const metadata: Metadata = {
  title: "About — Tarun Kumar Babbar | AI QA Architect",
  description:
    "18+ years in QA engineering — from Infosys, TCS, Varian and Coupa to AI-native quality engineering at Coforge Limited for Xplor Technologies.",
};

export default function AboutPage() {
  return (
    <>
      <About />
      <Education />
    </>
  );
}
