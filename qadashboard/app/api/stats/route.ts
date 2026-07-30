import { NextRequest } from "next/server";

// Stats are approximated from config — real counts come from DB once connected
export async function GET() {
  return Response.json({
    documents: 0,
    qaPairs: 405,
    jobs: 0,
    topics: 15,
    projects: 0,
  });
}
