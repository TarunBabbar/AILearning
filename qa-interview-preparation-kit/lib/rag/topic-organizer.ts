import { getOpenRouterClient } from "../openrouter";
import { getConfig } from "../config";
import { loadTopics, saveTopics, clearTopics as clearStoredTopics } from "./topic-store";
import type { IVectorStore } from "./vector-store";

export interface OrganizedTopic {
  name: string;
  questions: { question: string; answer: string; source: string }[];
}

/**
 * Fetch ALL Q&A pairs from the vector store and group them into LLM-generated topics.
 * Result is persisted via topic-store (Vercel KV on Vercel, file locally).
 */
export async function organizeByAI(store: IVectorStore): Promise<OrganizedTopic[]> {
  // Check persistent cache first
  const cached = await loadTopics();
  if (cached) return cached;

  const config = getConfig();
  const client = getOpenRouterClient();

  // 1. Fetch all documents and topics
  const topics = await store.getTopics();

  // 2. Fetch all questions for each topic
  const allPairs: { question: string; answer: string; source: string; originalTopic: string }[] = [];
  for (const topic of topics) {
    const qs = await store.getQuestionsByTopic(topic);
    for (const q of qs) {
      allPairs.push({ ...q, originalTopic: topic });
    }
  }

  if (allPairs.length === 0) return [];

  // 3. Send to LLM for smart topic classification
  // Batch in chunks of 100 to avoid huge prompts
  const BATCH = 100;
  const organized = new Map<string, { question: string; answer: string; source: string }[]>();
  const topicOrder: string[] = [];

  for (let i = 0; i < allPairs.length; i += BATCH) {
    const batch = allPairs.slice(i, i + BATCH);
    const batchJson = JSON.stringify(
      batch.map((p, idx) => ({ idx: i + idx, question: p.question, answer: p.answer.slice(0, 500) })),
      null,
      2
    );

    console.log(`[topic-organizer] Classifying batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(allPairs.length / BATCH)} (${batch.length} pairs)...`);

    const response = await client.chat.completions.create({
      model: config.llmModel,
      messages: [
        {
          role: "system",
          content: `You are a topic classifier for QA interview questions about software testing.

Given a JSON array of Q&A pairs (each with idx, question, answer preview), group them into meaningful topic categories.

Rules:
1. Create clear, professional topic names like "Selenium WebDriver", "API Testing Basics", "Agile Methodology", "SQL Queries", "Java OOP Concepts", "Playwright", "BDD & Cucumber", "Git & Version Control", "Manual Testing", "Test Automation Frameworks", "TestNG & JUnit", etc.
2. Each question should go into the SINGLE best-matching topic
3. Keep topics focused — don't create a "General" bucket if you can avoid it
4. Return a JSON object where keys are topic names and values are arrays of idx values
5. Return ONLY valid JSON, no markdown, no explanation

Example format:
{
  "Selenium WebDriver": [0, 5, 12],
  "API Testing": [1, 3, 7],
  "Agile & Scrum": [2, 8]
}`,
        },
        {
          role: "user",
          content: `Classify these Q&A pairs into topic groups:\n\n${batchJson}`,
        },
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || "{}";
    let parsed: Record<string, number[]>;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.warn("[topic-organizer] Failed to parse LLM response for batch, skipping");
      continue;
    }

    // Merge into organized map
    for (const [topic, idxs] of Object.entries(parsed)) {
      if (!Array.isArray(idxs)) continue;
      if (!organized.has(topic)) {
        organized.set(topic, []);
        topicOrder.push(topic);
      }
      for (const idx of idxs) {
        const pair = allPairs[idx];
        if (pair) {
          organized.get(topic)!.push({
            question: pair.question,
            answer: pair.answer,
            source: pair.source,
          });
        }
      }
    }
  }

  // Remove empty topics
  const result: OrganizedTopic[] = [];
  for (const topic of topicOrder) {
    const qs = organized.get(topic)!;
    if (qs.length > 0) {
      result.push({ name: topic, questions: qs });
    }
  }

  // Save to persistent store
  await saveTopics(result);
  return result;
}

/** Clear the cached topics (useful after new data is seeded) */
export function clearOrganizedCache() {
  clearStoredTopics();
}
