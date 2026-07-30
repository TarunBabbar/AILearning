import { NextRequest } from "next/server";
import { createPineconeStore } from "@/lib/rag/pinecone-store";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "file";

  // For now return file-based topics from the pre-seeded data
  // In production this reads from Pinecone + ai-topics.json cache
  const topics = [
    { name: "Software Testing", count: 35, questions: defaultQuestions("Software Testing") },
    { name: "Selenium & TestNG", count: 42, questions: defaultQuestions("Selenium & TestNG") },
    { name: "API Testing", count: 28, questions: defaultQuestions("API Testing") },
    { name: "Agile & Scrum", count: 22, questions: defaultQuestions("Agile & Scrum") },
    { name: "Database & SQL", count: 30, questions: defaultQuestions("Database & SQL") },
    { name: "Java", count: 38, questions: defaultQuestions("Java") },
    { name: "Playwright", count: 25, questions: defaultQuestions("Playwright") },
    { name: "BDD & Cucumber", count: 18, questions: defaultQuestions("BDD & Cucumber") },
    { name: "AI & Testing", count: 20, questions: defaultQuestions("AI & Testing") },
    { name: "Git", count: 15, questions: defaultQuestions("Git") },
    { name: "Situational Q&A", count: 40, questions: defaultQuestions("Situational Q&A") },
  ];

  if (mode === "ai") {
    // AI-refined topics regroup the same questions
    return Response.json({
      topics: [
        { name: "Core Testing Concepts", count: 50, questions: defaultQuestions("Core Testing Concepts") },
        { name: "Automation Frameworks", count: 65, questions: defaultQuestions("Automation Frameworks") },
        { name: "Programming & SQL", count: 68, questions: defaultQuestions("Programming & SQL") },
        { name: "Process & Methodology", count: 40, questions: defaultQuestions("Process & Methodology") },
        { name: "Interview Scenarios", count: 40, questions: defaultQuestions("Interview Scenarios") },
      ],
    });
  }

  return Response.json({ topics });
}

// Default Q&A pairs shown when Pinecone isn't seeded yet
function defaultQuestions(topic: string): { id: string; question: string; answer: string; source: string }[] {
  const pairs: Record<string, [string, string][]> = {
    "Software Testing": [
      ["What is the difference between verification and validation?",
       "Verification checks if the product is built correctly (static testing - reviews, walkthroughs), while validation checks if the right product is built (dynamic testing - executing tests)."],
      ["What is regression testing?",
       "Regression testing ensures that recent code changes haven't broken existing functionality. It's performed after bug fixes, enhancements, or configuration changes."],
      ["Explain smoke vs sanity testing.",
       "Smoke testing verifies critical functionalities before detailed testing begins. Sanity testing checks if a specific fix works without breaking related areas, done after receiving a build."],
    ],
    "Selenium & TestNG": [
      ["What is Selenium WebDriver?",
       "Selenium WebDriver is a browser automation framework that directly communicates with browsers using native browser drivers (ChromeDriver, GeckoDriver, etc.) without intermediary."],
      ["Explain the Page Object Model pattern.",
       "POM is a design pattern where each web page is represented by a class. Page elements are fields, and page methods represent user interactions. Improves maintainability and reduces code duplication."],
    ],
    "API Testing": [
      ["What is REST API testing?",
       "REST API testing validates RESTful web services by sending HTTP requests (GET, POST, PUT, DELETE) and verifying responses including status codes, headers, and body content."],
      ["What tools are used for API testing?",
       "Common tools include Postman, REST Assured (Java), Supertest (Node.js), pytest-requests (Python), and Karate DSL. Postman is popular for manual testing while REST Assured is used for automation."],
    ],
  };

  const defaultPair: [string, string] = [
    `Common ${topic} question?`,
    `This is a sample answer for ${topic}. In production, this content comes from the Pinecone vector store seeded with actual interview documents. Upload your PDFs to populate real Q&A pairs.`,
  ];

  const pairs_for_topic = pairs[topic] || [defaultPair];
  return pairs_for_topic.map(([q, a], i) => ({
    id: `${topic}-${i}`,
    question: q,
    answer: a,
    source: topic,
  }));
}
