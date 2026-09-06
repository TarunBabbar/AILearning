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
  roles: { date: string; title: string; company: string; tag?: string; details: string[] }[];
  education: string;
  skills: { title: string; top: string[]; rest: string[] }[];
  projects: { title: string; desc: string; tech: string[]; repo: string; demo: string | null }[];
  contact: { label: string; value: string; href: string }[];
};

export const profileKnowledge: ProfileKnowledge = {
  owner: "Tarun Kumar Babbar",
  headline:
    "AI QA Architect and Test Automation Engineer with 18+ years. Currently at Coforge Limited (Viman Nagar, Pune) working for client Xplor Technologies (Kharadi, Pune), building AI-powered quality engineering systems. 1st place at The Testing Academy's AI Tester Blueprint 3x hackathon (60 participants) with QAE2E, an agentic QA pipeline.",
  location: "Pune, India",
  yearsExperience: "18+",
  aiPlatformsBuilt: "10+",
  stats: [
    { num: "18+", label: "Years in QA Engineering" },
    { num: "10+", label: "AI Apps & Agents Built" },
    { num: "#1", label: "AI Tester Blueprint 3x Hackathon" },
    { num: "100%", label: "Automation Adoption at Scale" },
  ],
  highlights: [
    "AI-Powered QA Platforms",
    "Multi-Agent Orchestration",
    "DeepEval-Driven Output Validation",
    "Playwright + TypeScript Frameworks",
    "Figma → Requirements → Test Cases",
    "TFS / Azure DevOps Integration",
    "RAG & Vector DBs (ChromaDB, Pinecone)",
    "LLM Evaluation & Guardrails",
    "Enterprise CI/CD & YAML Pipelines",
    "0 → 100% Automation Adoption",
    "Framework Architecture & Mentorship",
    "MCP Protocol for Tool Integration",
  ],
  roles: [
    {
      date: "Aug 2026 — Present",
      title: "Solutions Architect",
      company:
        "Coforge Limited (Viman Nagar, Pune) · currently at client location Xplor Technologies, Kharadi, Pune",
      tag: "Current",
      details: [
        "Built a Playwright + TypeScript UI test automation framework for a Blazor-based application, using Azure DevOps, TFS, and YAML pipelines for CI",
        "Building a Multi-Agent Orchestration Framework that generates requirements from Figma designs, converts them into test cases, and publishes them to TFS through REST APIs using token auth",
        "Every AI-generated output is evaluated against quality metrics with DeepEval, with auto-duplicate scenario/test detection to stop similar scenarios from multiplying",
        "Generating automation code that follows the framework structure on Azure DevOps, with the full UI automation pipeline in place",
        "Reading user stories and converting them into test cases — identifying which existing tests belong to each story by reading the test-case repository",
        "Triggering automation runs automatically based on the scenarios under test, and presenting reports built with Cursor",
      ],
    },
    {
      date: "Jul 2025 — Jul 2026",
      title: "Career Transition — AI + Test Automation R&D",
      company: "Self-Directed Learning, Pune",
      details: [
        "Deep-dived into LLMs, RAG, MCP, AI agents and orchestration tools while strengthening LangChain, Playwright and TypeScript",
        "Shipped 10+ AI applications — RAG pipelines, agentic QA copilots and the QAE2E pipeline that took 1st place at The Testing Academy's AI Tester Blueprint 3x hackathon",
        "Core focus: test architecture & strategy, CI/CD and DevOps, and AI-native quality engineering",
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
        "Built WPF, MVC, and JavaScript integration testing utilities, saving ~4 hours/week across the QA team",
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
        "Migrated legacy KAF to Selenium with the Abstract Factory pattern — 40% faster test execution",
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
      title: "AI & Agentic QA",
      top: ["Multi-Agent Orchestration", "DeepEval (AI Output Evaluation)", "LLM-as-a-Judge", "RAG Pipelines", "Prompt Engineering"],
      rest: ["LangGraph", "CrewAI", "MCP Protocol", "Self-Healing Tests", "AI Observability", "Model Routing"],
    },
    {
      title: "Test Automation",
      top: ["Playwright", "TypeScript", "Selenium WebDriver", "BDD / SpecFlow / Cucumber"],
      rest: ["Pytest", "Cypress", "Appium", "REST Assured", "Postman", "NUnit / TestNG / JUnit", "k6 / JMeter"],
    },
    {
      title: "Platforms & Workflow",
      top: ["Azure DevOps", "TFS", "YAML Pipelines (CI/CD)", "Blazor App Testing"],
      rest: ["GitHub Actions", "Jenkins", "Docker", "Kubernetes", "Git", "Figma-to-Code Workflows"],
    },
    {
      title: "Languages",
      top: ["TypeScript", "C# .NET", "Python"],
      rest: ["JavaScript", "Java", "SQL"],
    },
    {
      title: "Vector DBs & Data",
      top: ["ChromaDB", "Pinecone"],
      rest: ["pgvector", "PostgreSQL", "SQLite", "Neon", "ETL Testing"],
    },
    {
      title: "Frameworks & Architecture",
      top: ["Page Object Model", "SOLID Principles", "8-Layer Framework Architecture"],
      rest: ["Microservices", "Next.js", "FastAPI", "Express", "REST APIs & Token Auth"],
    },
  ],
  projects: [
    {
      title: "QAE2E — AI-Powered QA Pipeline (1st Place, AI Tester Blueprint 3x)",
      desc: "An agentic QA platform that takes a requirement end-to-end — generating test cases, Playwright automation, executing them, and scoring release confidence. A team of specialist agents works each stage while an AI judge evaluates and refines every step. 1st place at The Testing Academy's AI Tester Blueprint 3x hackathon.",
      tech: ["Next.js", "OpenRouter", "Agent Orchestration", "Pinecone", "MCP", "Docker"],
      repo: "https://github.com/TarunBabbar/AILearning/tree/main/qae2e",
      demo: "https://qae2e.vercel.app",
    },
    {
      title: "QA Jobs Portal",
      desc: "Free daily India QA jobs portal — AI-extracted QA listings from multiple sources, curated and refreshed every day.",
      tech: ["Next.js", "PostgreSQL", "Prisma", "OpenRouter", "AI Extraction"],
      repo: "https://github.com/TarunBabbar/AILearning/tree/main/job-details",
      demo: "https://qajobs.vercel.app",
    },
    {
      title: "QA AI Dashboard",
      desc: "Unified AI platform — LLM-scored resume-job matcher, QA interview RAG chat, PRD test-case generator, AI tutor and document Q&A.",
      tech: ["Next.js", "PostgreSQL", "Prisma", "Pinecone", "OpenRouter"],
      repo: "https://github.com/TarunBabbar/AILearning/tree/main/qadashboard",
      demo: "https://qadashboard-lime.vercel.app",
    },
    {
      title: "QA RAG Platform",
      desc: "Upload documents and ask AI questions with grounded citations — smart chunking, configurable embeddings and Pinecone vector search.",
      tech: ["Next.js", "OpenRouter", "Pinecone", "Vector Search"],
      repo: "https://github.com/TarunBabbar/AILearning/tree/main/qaragplatform",
      demo: "https://qaragplatform.vercel.app",
    },
    {
      title: "QA Interview Preparation Kit",
      desc: "RAG-powered interview prep — PDF/DOCX knowledge base indexed into Pinecone with a streaming QA assistant and grounded citations.",
      tech: ["Next.js", "OpenRouter", "Pinecone", "RAG"],
      repo: "https://github.com/TarunBabbar/AILearning/tree/main/qa-interview-preparation-kit",
      demo: "https://qa-interview-preparation.vercel.app",
    },
    {
      title: "Jira QA Crew",
      desc: "QA pipeline driven by a crew of AI agents — connects to Jira stories and walks through analysis, test generation and execution workflows.",
      tech: ["Next.js", "Agent Crew", "TypeScript", "AI Pipeline"],
      repo: "https://github.com/TarunBabbar/jira-qa-crew-next",
      demo: "https://jira-qa-crew-next.vercel.app",
    },
    {
      title: "Resume → Job RAG Pipeline",
      desc: "Full-stack RAG pipeline: upload resume → AI profile extraction → multi-source job search → eligibility filter → LLM-ranked matches.",
      tech: ["React", "Express", "ChromaDB", "OpenRouter"],
      repo: "https://github.com/TarunBabbar/resume-job-rag",
      demo: null,
    },
    {
      title: "Chroma RAG Pipeline Visualizer",
      desc: "RAG visualizer with a live 3-panel UI — ingest PDFs/DOCX, embed via OpenRouter, vector search, and see the LLM answer with real-time progress.",
      tech: ["React", "Express", "ChromaDB", "SSE"],
      repo: "https://github.com/TarunBabbar/chroma-react-rag-pipeline",
      demo: null,
    },
    {
      title: "8-Layer Playwright Framework",
      desc: "Enterprise-grade Playwright framework with strict 8-layer architecture — POM, fixtures, API layer, reporting, Docker and CI-ready.",
      tech: ["Playwright", "TypeScript", "Docker", "CI/CD"],
      repo: "https://github.com/TarunBabbar/8layer-advance-playwright-framework",
      demo: null,
    },
    {
      title: "Self-Healing Playwright",
      desc: "AI-powered self-healing test framework that detects broken locators and repairs them automatically when the UI changes.",
      tech: ["Playwright", "GPT-4", "OpenAI", "TypeScript"],
      repo: "https://github.com/TarunBabbar/SelfHealingPlaywrightFramework",
      demo: null,
    },
  ],
  contact: [
    { label: "LinkedIn", value: "linkedin.com/in/tarunbabbar", href: "https://linkedin.com/in/tarunbabbar" },
    { label: "GitHub", value: "github.com/TarunBabbar", href: "https://github.com/TarunBabbar" },
    { label: "WhatsApp", value: "+91 9623252365", href: "https://wa.me/919623252365" },
    { label: "Phone", value: "+91 9623252365", href: "tel:+919623252365" },
  ],
};

function renderProfile(k: ProfileKnowledge): string {
  return `# About
${k.headline}
Location: ${k.location}
Experience: ${k.yearsExperience} years in QA engineering; ${k.aiPlatformsBuilt} AI applications and agentic systems built.
Hackathon: 1st place at The Testing Academy's AI Tester Blueprint 3x hackathon (60+ participants) with QAE2E, an AI-powered QA pipeline.

## Highlights
${k.highlights.map((h) => `- ${h}`).join("\n")}

## Career
${k.roles
  .map(
    (r) =>
      `### ${r.title} — ${r.company} (${r.date})${r.tag ? ` [${r.tag}]` : ""}\n${r.details.map((d) => `- ${d}`).join("\n")}`
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

Open to Architect / Principal SDET / Senior Principal SDET / QA Head roles — building one scalable, maintainable AI solution that serves multiple teams, onboarding them onto a shared QA AI Platform that delivers consistent, quality outputs organisation-wide.

## Stats
${k.stats.map((s) => `${s.label}: ${s.num}`).join(" | ")}`;
}

export function buildSystemPrompt(): string {
  return `You are ${profileKnowledge.owner}'s AI assistant — "Tarun's AI Assistant" — embedded in his personal profile website.

A visitor is chatting with you to learn about ${profileKnowledge.owner}. Answer ONLY using the profile knowledge below. Never invent facts about him that are not present here.

Rules:
- Be friendly, concise, and professional. Use short markdown (bold, bullets) for readability.
- If asked about anything covered by the profile (experience, skills, projects, education, contact, stats, location), answer directly from it.
- If asked about his current work or role, mention he works at Coforge Limited for client Xplor Technologies, building multi-agent AI QA frameworks (Figma → requirements → test cases on TFS via REST API, DeepEval evaluation, Playwright + TypeScript, Azure DevOps YAML pipelines).
- If asked about the hackathon or awards, mention he took 1st place at The Testing Academy's AI Tester Blueprint 3x hackathon with QAE2E (AI-powered QA pipeline).
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
