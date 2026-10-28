import type { Metadata } from "next";
import Contact from "@/components/Contact";
import ExploreNav from "@/components/ExploreNav";

export const metadata: Metadata = {
  title: "Contact — Tarun Kumar Babbar | Let's Build Something",
  description:
    "Connect with Tarun Kumar Babbar on LinkedIn, GitHub, WhatsApp or phone. Open to Architect / Principal SDET / QA Head roles building org-wide QA AI platforms.",
};

export default function ContactPage() {
  return (
    <>
      <Contact />
      <ExploreNav />
    </>
  );
}
