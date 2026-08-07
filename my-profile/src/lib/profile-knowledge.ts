// Mirrors the profile data rendered in src/components/*.tsx.
// Keep this in sync when the profile sections change.

export type ProfileKnowledge = {
  owner: string;
  headline: string;
  location: string;
  yearsExperience: string;
  aiPlatformsBuilt: string;
  stats: { num: string; label: string }[];
  highlights: string[];
  roles: { date: string; title: string; company: string; details: string[] }[];
  education: string;
  skills: { title: string; top: string[]; rest: string[] }[];
  projects: { title: string; desc: string; tech: string[]; repo: string; demo: string | null }[];
  contact: { label: string; value: string; href: string }[];
};

export const profileKnowledge: ProfileKnowledge = {
  owner: "Tarun Kumar Babbar",
  headline:
    "Test Automation Architect with 18+ years building enterprise-grade automation frameworks (Selenium, Playwright, C#.NET, TypeScript) across UI, API, database, and E2E. Designed a skills-based AI automation framework fusing classical test automation with RAG, MCP, and Vector DBs. Built 8+ AI platforms and agentic QA systems — from RAG pipelines to multi-agent test copilots.",
  location: "Pune, India",
  yearsExperience: "18+",
  aiPlatformsBuilt: "8+",
  stats: [
    { num: "18+", label: "Years in QA Engineering" },
    { num: "8", label: "AI Platforms Built" },
    { num: "100%", label: "Automation Adoption" },
    { num: "~40%", label: "Prod Defect Reduction" },
    { num: "10", label: "Projects Built" },
  ],
  highlights: [
    "Service & Product Org Leadership",
    "0 → 100% Automation Adoption",
    "AI QA Transformation",
    "Selenium WebDriver & Playwright",
    "RAG & Vector DBs (ChromaDB, Pinecone)",
    "Multi-Agent Orchestration (LangGraph)",
    "MCP Protocol for Tool Integration",
    "Azure DevOps & GitHub Actions",
    "C#, TypeScript, Python",
    "BDD / SpecFlow / Cucumber",
    "CI/CD & Quality Gates",
    "Framework Architecture & Mentorship",
  ],
  roles: [
    {
      date: "Aug 2026 — Present",
      title: "Solutions Architect",
      company: "Coforge Limited, Pune (Hybrid)",
      details: [
        "Solutions Architect focused on test automation strategy, bringing prior experience leading QA teams and driving quality initiatives",
        "Designing scalable automation frameworks, integrating continuous testing into CI/CD pipelines, and modernizing tooling across web, API, performance, and mobile",
        "Committed to quality governance — establishing standards and best practices that scale across cross-functional teams",
        "Mentoring engineers and building a strong quality-first culture, now applied at an architectural level",
      ],
    },
    {
      date: "Jul 2025 — Jul 2026",
      title: "Career Transition — Solutions Architect (Test Automation)",
      company: "Self-Directed Learning, Pune",
      details: [
        "Focused year diving deep into LLMs, RAG, MCP, AI agents, and orchestration tools like n8n and Langflow, plus LangChain, Playwright, and TypeScript",
        "Built a POC framework combining AI-driven skills-based prompting with E2E test automation — github.com/TarunBabbar",
        "Core focus: test architecture & strategy, CI/CD integration & DevOps, tooling & modernization (AI-native tooling like RAG and agent orchestration), and quality governance",
      ],
    },
    {
      date: "Jan 2018 — Jun 2025",
      title: "Lead Software Engineer in Test | Test Automation Architect",
      company: "Coupa Software, Pune",
      details: [
        "Architected full-stack automation suite (UI, API, DB, E2E) — transitioned 100% manual regression to 100% automated across 3+ product lines",
        "Delivered 100+ major UI automation cases in 9 months using C#.NET + Selenium, reducing manual regression by ~70%",
        "Built 50+ integration and 50+ API/database validation cases in 4 months, cutting production defects by ~40%",
        "Architected environment-agnostic CI/CD with Azure Pipelines + GitHub Actions, reducing deployment time by 30%",
        "Led, coached, and mentored 6 QA engineers — improved script maintainability by 30%, reduced script defects by 20%",
      ],
    },
    {
      date: "Aug 2016 — Dec 2017",
      title: "SW QA Engineer IV",
      company: "Varian Medical Systems, Pune",
      details: [
        "Designed Selenium UI automation + VSTS performance frameworks, reducing regression time by 30%",
        "Built WPF, MVC, and JavaScript integration testing utilities, saving ~4 hours/week across QA team",
        "Spearheaded cross-team API automation strategy, reducing manual API testing by 50%",
        "Championed SOLID principles and coding standards across 2 engineering teams",
      ],
    },
    {
      date: "Aug 2010 — Aug 2016",
      title: "Assistant Consultant",
      company: "Tata Consultancy Services, Pune",
      details: [
        "Architected enterprise test automation frameworks (C#.NET, Selenium, SpecFlow, Coded UI) — cut manual testing by 50%, boosted coverage by 20%",
        "Migrated legacy KAF to Selenium with Abstract Factory pattern — 40% faster test execution",
        "Owned CI/CD pipeline architecture and BDD strategy across 3+ development teams",
        "Reduced onboarding time by 30% through structured training for 10+ new hires",
      ],
    },
    {
      date: "Feb 2007 — Jul 2010",
      title: "Senior Systems Engineer",
      company: "Infosys Technologies, Pune",
      details: [
        "Validated 50% of critical Windows OS components across 2 dev teams, reducing critical bugs by 10% pre-release",
        "Automated 30+ manual workflows, reducing processing time by 40%",
        "Identified 50+ defects, validated 20+ Design Change Requests, reduced resolution time by 40%",
      ],
    },
  ],
  education: "Bachelor of Engineering, Computer Science — Modi Institute of Technology, Kota",
  skills: [
    {
      title: "Automation & Testing",
      top: ["Selenium WebDriver", "Playwright", "SpecFlow / BDD"],
      rest: ["Cypress", "Appium", "REST Assured", "Postman", "TestNG / JUnit", "Pytest", "Performance (k6, JMeter)"],
    },
    {
      title: "AI & LLM",
      top: ["RAG Pipelines", "Multi-Agent Orchestration", "LangGraph", "MCP Protocol"],
      rest: ["LLM Evaluation", "Prompt Engineering", "LLM-as-Judge", "Self-Healing Tests", "AI Observability"],
    },
    {
      title: "Vector DBs & Data",
      top: ["ChromaDB", "Pinecone"],
      rest: ["pgvector", "PostgreSQL", "SQLite", "Neon", "ETL Testing"],
    },
    {
      title: "Languages",
      top: ["C# .NET", "TypeScript", "Python"],
      rest: ["JavaScript", "Java", "SQL"],
    },
    {
      title: "CI/CD & DevOps",
      top: ["Azure DevOps", "GitHub Actions"],
      rest: ["Jenkins", "Docker", "Kubernetes", "Git"],
    },
    {
      title: "Frameworks & Architecture",
      top: ["Page Object Model", "SOLID Principles"],
      rest: ["Abstract Factory", "Microservices", "Next.js", "FastAPI", "Express"],
    },
  ],
  projects: [
    {
      title: "QAE2E — Agentic Quality Engineering",
      desc: "End-to-end agentic QA platform: 6 specialist agents (RI → MT → AS → EX → DO → IQ) turn a requirement into analysis, editable coverage, Playwright automation, Docker-executed evidence, and release-confidence intelligence. Connects Jira, Confluence, Figma, GitHub, Zephyr, TestRail, and ships a real MCP server.",
      tech: ["Next.js 15", "OpenRouter", "Vercel Postgres", "Pinecone", "MCP", "Docker"],
      repo: "https://github.com/TarunBabbar/AILearning/tree/main/qae2e",
      demo: "https://qae2e.vercel.app",
    },
    {
      title: "QA AI Dashboard",
      desc: "Unified platform: resume-job matcher (LLM-scored), QA interview prep RAG chat, test case generator from PRDs, AI learning tutor, document Q&A.",
      tech: ["Next.js 15", "Neon PostgreSQL", "Prisma", "Pinecone", "OpenRouter"],
      repo: "https://github.com/TarunBabbar/AILearning/tree/main/qadashboard",
      demo: "https://qadashboard-lime.vercel.app",
    },
    {
      title: "QA Interview Preparation Kit",
      desc: "RAG-powered interview prep: PDF/DOCX knowledge base indexed into Pinecone, streaming QA assistant with grounded citations, and topic-organized Q&A browser.",
      tech: ["Next.js 14", "OpenRouter", "Pinecone", "Tailwind"],
      repo: "https://github.com/TarunBabbar/AILearning/tree/main/qa-interview-preparation-kit",
      demo: "https://qa-interview-preparation.vercel.app",
    },
    {
      title: "QA RAG Platform",
      desc: "Upload documents, ask AI-powered questions with grounded citations. Supports PDF/DOCX/TXT/MD, smart chunking, configurable embeddings, Pinecone vector search.",
      tech: ["Next.js 14", "OpenRouter", "Pinecone", "Mammoth", "Tailwind"],
      repo: "https://github.com/TarunBabbar/AILearning/tree/main/qaragplatform",
      demo: "https://qaragplatform.vercel.app",
    },
    {
      title: "RAG Explorer",
      desc: "Transparent 3-panel RAG pipeline visualizer. Ingest PDFs/DOCX, watch chunking → embedding → ChromaDB storage → vector search → LLM answer via SSE.",
      tech: ["React", "Vite", "ChromaDB", "OpenRouter"],
      repo: "https://github.com/TarunBabbar/chroma-react-rag-pipeline",
      demo: "https://rag-explorer.vercel.app",
    },
    {
      title: "AI Test Architect (QA Copilot)",
      desc: "Multi-agent LangGraph system: PRD → test case generation, bug → regression selection, framework migration (Selenium → Playwright), Docker-sandboxed test execution.",
      tech: ["LangGraph", "FastAPI", "ChromaDB", "Next.js", "Docker"],
      repo: "https://github.com/TarunBabbar/AILearning/tree/main/ai-testarchitect",
      demo: null,
    },
    {
      title: "Resume Job RAG",
      desc: "Full-stack RAG pipeline for QA job seekers. Upload resume → AI profile extraction → multi-source job search → eligibility filtering → LLM-ranked matches.",
      tech: ["React", "Express", "ChromaDB", "OpenRouter"],
      repo: "https://github.com/TarunBabbar/resume-job-rag",
      demo: null,
    },
    {
      title: "8-Layer Playwright Framework",
      desc: "Enterprise-grade Playwright framework with strict 8-layer architecture — POM, modules, fixtures, API layer, custom reporting, Docker, and sharding.",
      tech: ["Playwright", "TypeScript", "Docker", "GitHub Actions"],
      repo: "https://github.com/TarunBabbar/8layer-advance-playwright-framework",
      demo: null,
    },
    {
      title: "Self-Healing Playwright Framework",
      desc: "AI-powered self-healing test framework using GPT-4 to detect and fix broken locators automatically when UI changes.",
      tech: ["Playwright", "GPT-4", "OpenAI", "TypeScript"],
      repo: "https://github.com/TarunBabbar/SelfHealingPlaywrightFramework",
      demo: null,
    },
    {
      title: "QA Multi-Agent Assistant",
      desc: "Multi-agent system orchestrating specialized AI agents for test case generation and automation code production from requirements.",
      tech: ["TypeScript", "AI Agents", "OpenAI"],
      repo: "https://github.com/TarunBabbar/QAMultiAgentAssistant",
      demo: null,
    },
  ],
  contact: [
    { label: "LinkedIn", value: "linkedin.com/in/tarunbabbar", href: "https://linkedin.com/in/tarunbabbar" },
    { label: "WhatsApp", value: "+91 9623252365", href: "https://wa.me/919623252365" },
    { label: "Phone", value: "+91 9623252365", href: "tel:+919623252365" },
    { label: "GitHub", value: "github.com/TarunBabbar", href: "https://github.com/TarunBabbar" },
  ],
};

function renderProfile(k: ProfileKnowledge): string {
  return `# About
${k.headline}
Location: ${k.location}
Experience: ${k.yearsExperience} years in QA engineering; ${k.aiPlatformsBuilt} AI platforms built.

## Highlights
${k.highlights.map((h) => `- ${h}`).join("\n")}

## Career
${k.roles
  .map(
    (r) =>
      `### ${r.title} — ${r.company} (${r.date})\n${r.details.map((d) => `- ${d}`).join("\n")}`
  )
  .join("\n\n")}

## Education
${k.education}

## Skills
${k.skills
  .map(
    (s) =>
      `### ${s.title}\nTop: ${s.top.join(", ")}\nAlso: ${s.rest.join(", ")}`
  )
  .join("\n\n")}

## Projects
${k.projects
  .map(
    (p) =>
      `### ${p.title}\n${p.desc}\nTech: ${p.tech.join(", ")}\nRepo: ${p.repo}${p.demo ? `\nDemo: ${p.demo}` : ""}`
  )
  .join("\n\n")}

## Contact
${k.contact
  .map((c) => `- ${c.label}: [${c.value}](${c.href})`)
  .join("\n")}

## Stats
${k.stats.map((s) => `${s.label}: ${s.num}`).join(" | ")}`;
}

export function buildSystemPrompt(): string {
  return `You are ${profileKnowledge.owner}'s AI assistant — "Tarun Bot" — embedded in his personal profile website.

A visitor is chatting with you to learn about ${profileKnowledge.owner}. Answer ONLY using the profile knowledge below. Never invent facts about him that are not present here.

Rules:
- Be friendly, concise, and professional. Use short markdown (bold, bullets) for readability.
- If asked about anything covered by the profile (experience, skills, projects, education, contact, stats, location), answer directly from it.
- When a visitor asks how to reach or contact Tarun, ALWAYS output the contact list as markdown links, one per line, with WhatsApp FIRST. Copy the exact link targets from the PROFILE KNOWLEDGE. Use the number/username as the link text — never the word "link". Example format (use these exact URLs):
  - 💬 [WhatsApp: +91 9623252365](https://wa.me/919623252365)
  - 📞 [Phone: +91 9623252365](tel:+919623252365)
  - 🔗 [LinkedIn: linkedin.com/in/tarunbabbar](https://linkedin.com/in/tarunbabbar)
  - 🐙 [GitHub: github.com/TarunBabbar](https://github.com/TarunBabbar)
  Then say he's generally responsive on WhatsApp or LinkedIn. Never mention X, Twitter, Medium, email, or any channel not in the list above.
- If you are asked about something NOT covered by the profile — general chat, unrelated help, advice, coding tasks, personal questions, or anything the profile cannot answer — respond with the marker line below followed by ONE clean sentence (no tags, no brackets, no explanations) that summarizes what the visitor is asking about. Then stop:
  [FORWARD_TO_TARUN]
  Example: [FORWARD_TO_TARUN]
  The visitor is asking for help fixing a bug in their React code.

PROFILE KNOWLEDGE:
${renderProfile(profileKnowledge)}`;
}
