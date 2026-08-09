import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, unauthorized } from "@/lib/session";
import { getConfig } from "@/lib/config";
import { assertFreeModel } from "@/lib/openrouter";

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  const cfg = getConfig();
  const settings = await prisma.userSettings.findUnique({ where: { userId } });

  return Response.json({
    llmModel: settings?.llmModel || cfg.llmModel,
    emailTemplate: settings?.emailTemplate || null,
    models: cfg.llmModels,
    // Read-only status (env-driven)
    status: {
      openrouter: Boolean(cfg.openrouterApiKey),
      gmail: Boolean(cfg.gmailUser && cfg.gmailPass),
      pinecone: Boolean(cfg.pineconeApiKey),
    },
  });
}

export async function PUT(req: NextRequest) {
  const userId = await getSessionUserId(req);
  if (!userId) return unauthorized();

  try {
    const body = await req.json();
    const llmModel = typeof body.llmModel === "string" ? body.llmModel : undefined;
    const emailTemplate = typeof body.emailTemplate === "string" ? body.emailTemplate.slice(0, 12000) : undefined;
    if (!llmModel && emailTemplate === undefined) return Response.json({ error: "Setting required" }, { status: 400 });

    if (llmModel) assertFreeModel(llmModel);

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: {
        ...(llmModel ? { llmModel } : {}),
        ...(emailTemplate !== undefined ? { emailTemplate } : {}),
      },
      create: { userId, llmModel: llmModel || null, emailTemplate: emailTemplate || null },
    });

    return Response.json({ success: true, llmModel: settings.llmModel, emailTemplate: settings.emailTemplate });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to save settings" },
      { status: 400 }
    );
  }
}
