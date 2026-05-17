import { NextResponse } from "next/server";
import { listConversations, listMessages } from "@/lib/data-v2";
import { getPersona } from "@/lib/personas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const personaId = url.searchParams.get("personaId");
  const conversationId = url.searchParams.get("conversationId");

  if (conversationId) {
    const messages = await listMessages(conversationId);
    return NextResponse.json({ messages });
  }

  if (!personaId || !getPersona(personaId)) {
    return NextResponse.json({ error: "personaId required" }, { status: 400 });
  }
  const conversations = await listConversations(personaId);
  return NextResponse.json({ conversations });
}
