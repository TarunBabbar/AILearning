export type SitePage = {
  label: string;
  href: string;
  icon: string;
  blurb: string;
};

export const PAGES: SitePage[] = [
  {
    label: "Home",
    href: "/",
    icon: "🏠",
    blurb: "Start here — the 30-second version of who I am and what I build.",
  },
  {
    label: "About",
    href: "/about",
    icon: "🧭",
    blurb: "18+ years of QA engineering and the shift into AI-native quality platforms.",
  },
  {
    label: "AI Apps",
    href: "/apps",
    icon: "🤖",
    blurb: "10+ live AI apps — RAG pipelines, QA copilots and the QAE2E hackathon winner.",
  },
  {
    label: "Skills",
    href: "/skills",
    icon: "🛠",
    blurb: "Playwright, TypeScript, DeepEval, agent orchestration, RAG and Azure DevOps.",
  },
  {
    label: "Career",
    href: "/career",
    icon: "📈",
    blurb: "Infosys → TCS → Varian → Coupa → Coforge — the full professional timeline.",
  },
  {
    label: "Interests",
    href: "/interests",
    icon: "🔮",
    blurb: "Astrology, numerology, Vastu, Akashic Records and the occult sciences.",
  },
  {
    label: "Contact",
    href: "/contact",
    icon: "✉️",
    blurb: "Open to Architect / QA Head roles — reach out and let's talk quality.",
  },
];

export type SocialLink = {
  label: string;
  href: string;
  handle: string;
};

// Single source of truth for Tarun's social profiles.
export const SOCIALS: SocialLink[] = [
  {
    label: "LinkedIn",
    href: "https://linkedin.com/in/tarunbabbar",
    handle: "in/tarunbabbar",
  },
  {
    label: "GitHub",
    href: "https://github.com/TarunBabbar",
    handle: "github.com/TarunBabbar",
  },
];
