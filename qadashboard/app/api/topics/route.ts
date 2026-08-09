import { NextRequest } from "next/server";
import { getTopicDetail, getTopicsSummary } from "@/lib/topics-data";

/**
 * GET /api/topics
 * - default / ?summary=1 → lightweight topic list (name + count)
 * - ?topic=Name → questions for one topic only
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const topicName = searchParams.get("topic")?.trim();

  if (topicName) {
    const topic = getTopicDetail(topicName);
    if (!topic) {
      return Response.json({ error: "Topic not found" }, { status: 404 });
    }
    return Response.json(
      {
        topic: {
          name: topic.name,
          count: topic.questions.length,
          questions: topic.questions.map((q, i) => ({
            id: `${topic.name}-${i}`,
            question: q.question,
            answer: q.answer,
            source: q.source,
          })),
        },
      },
      {
        headers: { "Cache-Control": "private, max-age=120" },
      }
    );
  }

  const topics = getTopicsSummary();
  return Response.json(
    { topics, total: topics.length },
    {
      headers: { "Cache-Control": "private, max-age=120" },
    }
  );
}
