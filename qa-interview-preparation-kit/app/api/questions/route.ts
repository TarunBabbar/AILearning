import { NextRequest, NextResponse } from "next/server";
import { getVectorStore } from "../../../lib/rag/vector-store-factory";
import { organizeByAI } from "../../../lib/rag/topic-organizer";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get("topic");
    const mode = searchParams.get("mode") || "file";

    const store = await getVectorStore();

    if (mode === "ai") {
      const organized = await organizeByAI(store);
      if (topic) {
        const found = organized.find((t) => t.name === topic);
        return NextResponse.json({
          topic,
          questions: found?.questions || [],
        });
      }
      return NextResponse.json({
        topics: organized.map((t) => t.name),
        aiOrganized: true,
      });
    }

    const topics = await store.getTopics();

    if (topic) {
      const raw = await store.getQuestionsByTopic(topic);
      const questions = raw.map((q) => ({
        question: q.question,
        answer: q.answer,
        source: q.source,
      }));
      return NextResponse.json({ topic, questions });
    }

    return NextResponse.json({ topics });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch questions" },
      { status: 500 }
    );
  }
}
