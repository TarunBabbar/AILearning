import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";

const globalProjects = globalThis as unknown as { __projects?: any[] };
if (!globalProjects.__projects) globalProjects.__projects = [];

export async function GET() {
  return Response.json({ projects: globalProjects.__projects || [] });
}

export async function POST(req: NextRequest) {
  try {
    const { name, description, jiraUrl } = await req.json();
    const project = {
      id: uuid(),
      name,
      description: description || null,
      jiraUrl: jiraUrl || null,
      createdAt: new Date().toISOString(),
      testCases: 0,
    };
    globalProjects.__projects!.push(project);
    return Response.json(project);
  } catch (err) {
    return Response.json({ error: "Failed to create" }, { status: 500 });
  }
}
