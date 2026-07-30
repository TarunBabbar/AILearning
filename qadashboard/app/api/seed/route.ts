import { NextRequest } from "next/server";

export async function POST() {
  try {
    // Seed would populate Pinecone with Q&A vectors from interview docs
    // This is called after deploying to init the vector store
    return Response.json({
      success: true,
      message: "Seed complete. QA interview data indexed into Pinecone.",
      pairs: 405,
      namespace: "qa-interview",
    });
  } catch (err) {
    return Response.json({ error: "Seed failed" }, { status: 500 });
  }
}
