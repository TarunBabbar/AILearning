import type { Metadata } from "next";
import Career from "@/components/Career";

export const metadata: Metadata = {
  title: "Career — Tarun Kumar Babbar | Professional Path",
  description:
    "Career timeline: Solutions Architect at Coforge Limited (client Xplor Technologies), AI + Test Automation R&D, Coupa Software, Varian Medical Systems, TCS and Infosys.",
};

export default function CareerPage() {
  return (
    <>
      <Career />
    </>
  );
}
