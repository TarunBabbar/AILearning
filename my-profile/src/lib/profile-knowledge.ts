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
  pipelines: {
    name: string;
    purpose: string;
    inputs: string[];
    steps: string[];
    outputs: string[];
  }[];
  roles: { date: string; title: string; company: string; tag?: string; details: string[] }[];
  education: string;
  personalInterests: {
    summary: string;
    disciplines: { title: string; desc: string }[];
    learner: string;
  };
  skills: { title: string; top: string[]; rest: string[] }[];
  projects: { title: string; desc: string; tech: string[]; repo: string; demo: string | null }[];
  github: {
    org: string;
    orgUrl: string;
    summary: string;
    monorepo: {
      name: string;
      url: string;
      summary: string;
      subprojects: { folder: string; what: string }[];
    };
    standaloneRepos: { name: string; url: string; what: string }[];
  };
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
    "Auto Duplicate Scenario Detection",
    "Test Case Generation: JIRA + Figma → TFS",
    "Automation Generation into an Existing Framework",
    "Skills.md-Driven Automation Recipes",
    "Live DOM Healing via MCP Playwright",
    "Generated Specs, Page Files & Helpers",
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
  pipelines: [
    {
      name: "Pipeline 1 — Test Case Generation",
      purpose:
        "Turns JIRA, Figma and product-code information into a test plan and then into reviewed, de-duplicated test cases published to TFS.",
      inputs: ["JIRA stories", "Figma designs", "Product code information"],
      steps: [
        "JIRA stories, Figma designs and product-code information are ingested as the source material",
        "A Test Plan is generated and evaluated with DeepEval",
        "The Test Case Generator converts the test plan into test cases",
        "Each generated output is evaluated again with DeepEval",
        "Existing cases are pulled from TFS and duplicates are verified",
        "Approval gate: manual when duplicates surface or the DeepEval score is low, otherwise automatic",
        "Approved test cases are pushed to TFS over REST APIs using token auth",
      ],
      outputs: ["Test cases in TFS", "Traceable to the source story"],
    },
    {
      name: "Pipeline 2 — Automation Code Generation",
      purpose:
        "Builds a skill file from the selected test cases, Figma and the product code, passes it to the LLM to generate Playwright automation into the existing framework, runs it, fixes failures with a live DOM detector, and pushes the code to a new branch.",
      inputs: [
        "Figma",
        "Test cases",
        "Product code",
        "Existing TypeScript + Playwright framework",
      ],
      steps: [
        "The selected test cases, Figma designs and product code are read",
        "A Skills.md skill file is created from them — the automation recipe",
        "That skill file is passed to the LLM, which generates the automation code: new specs, page files, helpers and the other artifacts the tests need, following the existing framework structure",
        "The generated tests are executed",
        "When tests fail, a live DOM detector captures the real elements over MCP Playwright so the failure can be fixed",
        "Tests are re-run until green, then the code is pushed to a new branch",
      ],
      outputs: [
        "New specs, page files and helpers",
        "Run-verified build",
        "Pushed to a new branch",
      ],
    },
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
        "Every AI-generated output — requirements, test cases and automation code — is evaluated against quality metrics with DeepEval, with model-driven decisions made through agentic prompting",
      ],
    },
    {
      date: "Jul 2025 — Jul 2026",
      title: "Career Break — AI + Test Automation R&D",
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
  personalInterests: {
    summary:
      "My personal interests lie in astrology and the occult sciences — the timeless study of how energy and unseen forces are believed to shape our lives. What began as curiosity has grown into a deep and enduring passion, one I pursue through both quiet study and hands-on practice. In my personal time I practise these disciplines and offer guidance to people in need, across traditions that share a common belief: that subtle energies and hidden patterns influence our health, relationships and choices.",
    disciplines: [
      {
        title: "Astrology",
        desc: "Reading the movement of the planets and stars to understand character, timing and the rhythms of life.",
      },
      {
        title: "Numerology",
        desc: "Interpreting the meaning carried by numbers, names and dates, and how they shape a person's path.",
      },
      {
        title: "Watch Analysis",
        desc: "Reading the subtle energies and numerological signals carried by the watches we wear and the time we keep.",
      },
      {
        title: "Vastu",
        desc: "Aligning homes and spaces with natural forces so that surroundings support balance, harmony and wellbeing.",
      },
      {
        title: "Akashic Records",
        desc: "Exploring the unseen record of a soul's journey to uncover insight, purpose and healing.",
      },
      {
        title: "Psychic Mastery",
        desc: "Developing intuition and the capacity to sense and work with energies beyond the physical world.",
      },
    ],
    learner:
      "A continuous learner committed to the occult sciences — devoting time to ongoing research and study, deepening understanding of these traditions, refining the craft, and staying open to what each new line of inquiry reveals. For him, learning here is never finished; it is a lifelong journey into the unseen.",
  },
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
      desc: "An agentic QA platform that takes a requirement end-to-end — six specialist agents (Requirement Intelligence → Manual Test Cases → Automation Scripts → Execution & Defects → DevOps Evidence → Release Confidence) generate test coverage, produce Playwright scripts, run them in real Docker, and score release confidence, with an AI judge evaluating and refining every step. Ships a real MCP server exposing 27 QA tools and connectors for Jira, Confluence, Figma, GitHub, Zephyr and TestRail. Took 1st place at The Testing Academy's AI Tester Blueprint 3x hackathon (60+ participants).",
      tech: ["Next.js", "OpenRouter", "Agent Orchestration", "Pinecone", "MCP", "Docker"],
      repo: "https://github.com/TarunBabbar/AILearning/tree/main/qae2e",
      demo: "https://qae2e.vercel.app",
    },
    {
      title: "QABuddy — Hybrid RAG QA Assistant",
      desc: "Ask one QA question, get one cited answer from the whole QA knowledge base — Jira stories, test cases and bugs plus the real Playwright UI and API automation code. Hybrid dense + BM25 retrieval fused client-side, hosted reranking, and model-agnostic grounding that verifies every answer against the sources it was given.",
      tech: ["FastAPI", "Pinecone", "OpenRouter", "Hybrid RAG", "Vercel"],
      repo: "https://github.com/TarunBabbar/qa-rag",
      demo: "https://qa-rag-five.vercel.app",
    },
    {
      title: "QA Jobs Portal",
      desc: "Free daily India QA jobs portal — AI-extracted QA listings from multiple sources, parsed into structured jobs and refreshed every day.",
      tech: ["Next.js", "PostgreSQL", "Prisma", "OpenRouter", "AI Extraction"],
      repo: "https://github.com/TarunBabbar/AILearning/tree/main/job-details",
      demo: "https://qajobs.vercel.app",
    },
    {
      title: "QA AI Dashboard",
      desc: "Unified AI platform — LLM-scored resume–job matcher, QA interview RAG chat grounded in 510+ Q&A pairs, PRD test-case generator, AI tutor and document Q&A, all behind a Claude-style UI.",
      tech: ["Next.js", "PostgreSQL", "Prisma", "Pinecone", "OpenRouter"],
      repo: "https://github.com/TarunBabbar/AILearning/tree/main/qadashboard",
      demo: "https://qadashboard-lime.vercel.app",
    },
    {
      title: "QA RAG Platform",
      desc: "Upload documents and ask AI questions with grounded citations — smart chunking with overlap, configurable embeddings and Pinecone vector search, plus a Migration Studio that imports suites from 20+ enterprise sources and a Project Scanner for framework/locator readiness.",
      tech: ["Next.js", "OpenRouter", "Pinecone", "Vector Search"],
      repo: "https://github.com/TarunBabbar/AILearning/tree/main/qaragplatform",
      demo: "https://qaragplatform.vercel.app",
    },
    {
      title: "QA Interview Preparation Kit",
      desc: "RAG-powered interview preparation — PDF/DOCX knowledge base indexed into Pinecone with a streaming QA assistant and grounded citations.",
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
      desc: "RAG visualizer with a live 3-panel UI — ingest PDFs/DOCX, embed via OpenRouter, vector search, and watch the LLM answer with real-time progress.",
      tech: ["React", "Express", "ChromaDB", "SSE"],
      repo: "https://github.com/TarunBabbar/chroma-react-rag-pipeline",
      demo: null,
    },
    {
      title: "8-Layer Playwright Framework",
      desc: "Enterprise-grade Playwright framework with a strict 8-layer architecture — POM, fixtures, API layer, reporting, Docker and CI-ready.",
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
  github: {
    org: "github.com/TarunBabbar",
    orgUrl: "https://github.com/TarunBabbar",
    summary:
      "Tarun's public GitHub. The profile features 11 flagship apps and frameworks; his account holds 30+ repositories in total, including Selenium and Appium suites, API automation, C#/.NET frameworks and agent experiments.",
    monorepo: {
      name: "AILearning",
      url: "https://github.com/TarunBabbar/AILearning",
      summary:
        "A monorepo of AI and QA engineering projects — every folder is a standalone app with its own README, package.json/requirements and env setup. Most AI apps use OpenRouter free models only, and they share a Claude-inspired warm-cream/beige or amber UI theme.",
      subprojects: [
        { folder: "resume-parser", what: "Resume + job PDF matcher — LLM job extraction, match scoring, a hiring pipeline and Gmail SMTP outreach agents" },
        { folder: "job-details", what: "Job-listing PDF/DOCX extractor that parses listings into structured jobs in PostgreSQL — powers the QA Jobs Portal" },
        { folder: "qadashboard", what: "QA AI Dashboard — resume matcher, interview prep, document RAG, test-case generation and AI tutor in one UI" },
        { folder: "qae2e", what: "QAE2E agentic QA platform (1st place, AI Tester Blueprint 3x) with a 27-tool MCP server" },
        { folder: "qa-interview-preparation-kit", what: "RAG interview prep over a PDF/DOCX knowledge base with grounded citations" },
        { folder: "qaragplatform", what: "Document RAG platform with Migration Studio and Project Scanner" },
        { folder: "ai-testarchitect", what: "QA Copilot — a LangGraph multi-agent test-case generator with a FastAPI backend" },
        { folder: "ai-video-generation", what: "Mom & Son cartoon video generator (Python, OpenRouter, Edge-TTS, ffmpeg)" },
        { folder: "my-profile", what: "This portfolio site, including the AI assistant chatbot" },
        { folder: "learning-playwright-typescript-framework", what: "A from-zero Playwright + TypeScript framework learning journey" },
        { folder: "interview-preparation", what: "Senior AI QA Engineer interview prep (Python/Pytest exercise suites)" },
      ],
    },
    standaloneRepos: [
      { name: "qa-rag", url: "https://github.com/TarunBabbar/qa-rag", what: "QABuddy — hybrid RAG QA assistant (FastAPI + Pinecone)" },
      { name: "jira-qa-crew-next", url: "https://github.com/TarunBabbar/jira-qa-crew-next", what: "Jira QA Crew — an agent-crew QA pipeline" },
      { name: "resume-job-rag", url: "https://github.com/TarunBabbar/resume-job-rag", what: "Resume → job RAG pipeline (React + Express + ChromaDB)" },
      { name: "chroma-react-rag-pipeline", url: "https://github.com/TarunBabbar/chroma-react-rag-pipeline", what: "Chroma RAG pipeline visualizer" },
      { name: "8layer-advance-playwright-framework", url: "https://github.com/TarunBabbar/8layer-advance-playwright-framework", what: "8-layer Playwright framework" },
      { name: "SelfHealingPlaywrightFramework", url: "https://github.com/TarunBabbar/SelfHealingPlaywrightFramework", what: "Self-healing Playwright framework" },
    ],
  },
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

## AI QA Platform — the two pipelines
${k.pipelines
  .map(
    (p) =>
      `### ${p.name}\nWhat it does: ${p.purpose}\nInputs: ${p.inputs.join(", ")}\nSteps:\n${p.steps
        .map((s, i) => `${i + 1}. ${s}`)
        .join("\n")}\nOutput: ${p.outputs.join(", ")}`
  )
  .join("\n\n")}

## Career
${k.roles
  .map(
    (r) =>
      `### ${r.title} — ${r.company} (${r.date})${r.tag ? ` [${r.tag}]` : ""}\n${r.details.map((d) => `- ${d}`).join("\n")}`
  )
  .join("\n\n")}

## Education
${k.education}

## Personal Interests
${k.personalInterests.summary}
${k.personalInterests.disciplines.map((d) => `- ${d.title}: ${d.desc}`).join("\n")}
${k.personalInterests.learner}

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

## GitHub & Repositories
${k.github.org} — ${k.github.summary}
Every app above links here; below is where each one lives.

Monorepo: ${k.github.monorepo.name} (${k.github.monorepo.url})
${k.github.monorepo.summary}
${k.github.monorepo.subprojects.map((s) => `- ${s.folder}: ${s.what}`).join("\n")}

Standalone repositories:
${k.github.standaloneRepos.map((r) => `- ${r.name} (${r.url}): ${r.what}`).join("\n")}

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

A visitor can ask you ANYTHING about ${profileKnowledge.owner}: his experience, career history, skills, education, the AI apps shown on the page, the GitHub repositories behind them, their tech stacks, what each app does and how it works, his current role and pipelines, awards, and how to reach him. Answer using ONLY the profile knowledge below. Never invent facts about him that are not present here.

Rules:
- Be friendly, concise, and professional. Use short markdown (bold, bullets) for readability.
- If asked about anything covered by the knowledge (experience, skills, projects, GitHub repos, education, contact, stats, location, appearances), answer directly from it.
- The page links live apps and GitHub repositories. When a question names a specific app, repo or technology, answer from the matching entry in PROJECTS / GITHUB & REPOSITORIES, and include its live demo and/or GitHub link when that helps the visitor.
- If asked what he has built, or about his AI apps or repos as a group, cover the projects in the knowledge (QAE2E, QABuddy, QA Jobs Portal, QA AI Dashboard, QA RAG Platform, QA Interview Prep Kit, Jira QA Crew, Resume → Job RAG Pipeline, Chroma RAG Pipeline Visualizer, 8-Layer Playwright Framework, Self-Healing Playwright), one line each, and point to ${profileKnowledge.github.org} for the rest.
- If asked where code lives, explain the AILearning monorepo and the standalone repositories exactly as listed in GITHUB & REPOSITORIES.
- If asked about his current work or role, mention he works at Coforge Limited for client Xplor Technologies, building a multi-agent AI QA platform made of TWO pipelines.
- If asked about the test case generation pipeline (JIRA + Figma → test cases), describe Pipeline 1 exactly as in the PROFILE KNOWLEDGE: JIRA + Figma + product-code information → Test Plan → DeepEval → Test Case Generator → DeepEval → pull TFS → verify duplicates → approval gate (manual when duplicates surface or the DeepEval score is low, otherwise automatic) → push test cases to TFS over REST APIs with token auth.
- If asked about the automation generation pipeline (test cases → automation code), describe Pipeline 2 exactly as in the PROFILE KNOWLEDGE: the skill file (Skills.md) is created by reading the test cases, Figma and the product code; that skill file is passed to the LLM, which generates the automation — new specs, page files, helpers and the other artifacts the tests need — into the existing TypeScript + Playwright framework; the generated tests are run; when they fail, a live DOM detector captures the real elements over MCP Playwright so the failure can be fixed; tests are re-run until green; and the code is pushed to a new branch.
- If asked about the hackathon or awards, mention he took 1st place at The Testing Academy's AI Tester Blueprint 3x hackathon with QAE2E (AI-powered QA pipeline).
- If asked about hiring, roles or availability, mention he is open to Architect / Principal SDET / Senior Principal SDET / QA Head roles.
- If asked about his personal interests or hobbies, describe them exactly as in the PERSONAL INTERESTS section: a deep interest in astrology and the occult sciences, practising disciplines and offering guidance to people in need across Astrology, Numerology, Watch Analysis, Vastu, Akashic Records and Psychic Mastery, and his commitment to lifelong learning in these traditions.
- When a visitor asks how to reach or contact Tarun, ALWAYS output the contact list as markdown links, one per line, with WhatsApp FIRST. Copy the exact link targets from the PROFILE KNOWLEDGE. Use the number/username as the link text — never the word "link". Example format (use these exact URLs):
  - 💬 [WhatsApp: +91 9623252365](https://wa.me/919623252365)
  - 📞 [Phone: +91 9623252365](tel:+919623252365)
  - 🔗 [LinkedIn: linkedin.com/in/tarunbabbar](https://linkedin.com/in/tarunbabbar)
  - 🐙 [GitHub: github.com/TarunBabbar](https://github.com/TarunBabbar)
  Then say he's generally responsive on WhatsApp or LinkedIn. Never mention X, Twitter, Medium, email, or any channel not in the list above.
- If you are asked about something NOT covered anywhere in the knowledge below — unrelated chit-chat, personal advice, coding help on the visitor's own project, or any fact about Tarun the profile does not contain — respond with the marker line below followed by ONE clean sentence (no tags, no brackets, no explanations) that summarizes what the visitor is asking about. Then stop:
  [FORWARD_TO_TARUN]
  Example: [FORWARD_TO_TARUN]
  The visitor is asking for help fixing a bug in their React code.

PROFILE KNOWLEDGE:
${renderProfile(profileKnowledge)}`;
}
