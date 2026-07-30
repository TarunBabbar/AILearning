import { createUser } from "@/lib/auth";

export async function POST() {
  try {
    const user = createUser("TarunBabbar", "TarunBabbar");
    return Response.json({ user, message: "Default user created" });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 }
    );
  }
}
