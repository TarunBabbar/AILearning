import { NextRequest, NextResponse } from "next/server";
import { getVectorStore } from "../../../lib/rag/vector-store-factory";

export async function GET(req: NextRequest) {
  try {
    const store = await getVectorStore();

    const [docs, chunkCount, topics] = await Promise.all([
      store.listDocuments(),
      store.getChunkCount(),
      store.getTopics(),
    ]);

    return NextResponse.json({
      documents: docs,
      documentCount: docs.length,
      chunks: chunkCount,
      topics,
      topicCount: topics.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { documents: [], documentCount: 0, chunks: 0, topics: [], topicCount: 0 },
      { status: 200 }
    );
  }
}
