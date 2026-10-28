import type { Metadata } from "next";
import PersonalInterests from "@/components/PersonalInterests";

export const metadata: Metadata = {
  title: "Interests — Tarun Kumar Babbar | Beyond Work",
  description:
    "Beyond work: a deep interest in astrology and the occult sciences — numerology, watch analysis, Vastu, Akashic Records and psychic mastery.",
};

export default function InterestsPage() {
  return (
    <>
      <PersonalInterests />
    </>
  );
}
