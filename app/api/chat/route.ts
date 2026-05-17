/**
 * POST /api/chat — streaming chat endpoint shared by JarvisHome + JarvisFinance.
 *
 * Body:
 *   {
 *     personaId: "home" | "finance",
 *     conversationId?: string,
 *     messages: UIMessage[]   // from @ai-sdk/react useChat
 *   }
 *
 * Behaviour:
 *   1. Resolve persona (404 if unknown).
 *   2. Resolve model via lib/ai/provider.ts — if no API key, return an
 *      offline data-stream so the UI shows a friendly message.
 *   3. Build the tool subset from the persona's allow-list.
 *   4. Stream the response back; persist conversation + final message + usage
 *      after the stream finishes.
 */

import { streamText, convertToCoreMessages, type Message } from "ai";

import { getModel, estimateCostUsd, OFFLINE_REPLY } from "@/lib/ai";
import { getPersona } from "@/lib/personas";
import { toolsFor } from "@/lib/tools";
import {
  appendMessage,
  createConversation,
  logUsage,
  touchConversation,
} from "@/lib/data-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatBody {
  personaId?: string;
  conversationId?: string;
  messages: Message[];
}

export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const persona = getPersona(body.personaId ?? "home");
  if (!persona) return jsonError(`Unknown persona: ${body.personaId}`, 404);

  const resolved = getModel(persona.defaultModel);
  if (!resolved) {
    // Offline fallback — pretend to stream a single assistant message.
    return offlineStream(OFFLINE_REPLY);
  }

  const messages = body.messages ?? [];
  if (messages.length === 0) return jsonError("No messages provided", 400);

  // Ensure conversation row exists so persistence + sidebar history work.
  let conversationId = body.conversationId;
  if (!conversationId) {
    const firstUserContent = messages.find((m) => m.role === "user")?.content ?? "";
    const seedTitle =
      typeof firstUserContent === "string" && firstUserContent.trim().length > 0
        ? firstUserContent.slice(0, 60)
        : `Chat with ${persona.displayName}`;
    try {
      const conv = await createConversation(persona.id, seedTitle);
      conversationId = conv.id;
    } catch {
      // Persistence is best-effort. Don't block the chat if Supabase is down.
      conversationId = undefined;
    }
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMsg && conversationId) {
    appendMessage({
      conversation_id: conversationId,
      role: "user",
      content: typeof lastUserMsg.content === "string" ? lastUserMsg.content : JSON.stringify(lastUserMsg.content),
    }).catch(() => {});
  }

  const tools = toolsFor(persona.tools);

  const result = streamText({
    model: resolved.model,
    system: persona.systemPrompt,
    messages: convertToCoreMessages(messages),
    tools,
    maxSteps: 6,
    temperature: 0.4,
    onFinish: async ({ text, usage }) => {
      if (!conversationId) return;
      try {
        await appendMessage({
          conversation_id: conversationId,
          role: "assistant",
          content: text,
          meta: {
            provider: resolved.provider,
            model: resolved.modelId,
            usage,
          },
        });
        await touchConversation(conversationId);
        await logUsage({
          persona_id: persona.id,
          provider: resolved.provider,
          model_id: resolved.modelId,
          prompt_tokens: usage.promptTokens ?? 0,
          completion_tokens: usage.completionTokens ?? 0,
          estimated_cost_usd: estimateCostUsd(resolved.provider, resolved.modelId, {
            promptTokens: usage.promptTokens ?? 0,
            completionTokens: usage.completionTokens ?? 0,
          }),
        });
      } catch (err) {
        console.warn("chat persistence failed:", err);
      }
    },
  });

  // Pass conversationId back to the client via response header so the next
  // message in the same thread can reuse it.
  const response = result.toDataStreamResponse({
    headers: conversationId ? { "x-jarvis-conversation-id": conversationId } : undefined,
  });
  return response;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Emit a minimal AI-SDK-compatible data stream containing a single assistant
 * text reply. Used when no AI provider key is configured.
 */
function offlineStream(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // AI SDK data-stream protocol: lines like `0:"text"\n` for text deltas
      // and `d:{"finishReason":"stop","usage":{...}}\n` for done.
      for (const chunk of text.match(/.{1,40}/g) ?? [text]) {
        controller.enqueue(encoder.encode(`0:${JSON.stringify(chunk)}\n`));
      }
      controller.enqueue(
        encoder.encode(
          `d:${JSON.stringify({
            finishReason: "stop",
            usage: { promptTokens: 0, completionTokens: 0 },
          })}\n`,
        ),
      );
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-vercel-ai-data-stream": "v1",
    },
  });
}
