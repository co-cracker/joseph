import { GoogleGenAI } from "@google/genai";
import type { NextRequest } from "next/server";

import { SYSTEM_PROMPT, buildUserMessage } from "@/lib/prompt";

// Node runtime — the edge runtime has tighter timeouts and the streaming
// helpers behave more predictably here.
export const runtime = "nodejs";
// Vercel Hobby caps function execution at 60s; Pro goes up to 300s. Bump
// this only if you upgrade.
export const maxDuration = 300;

interface AnalyzeRequest {
  bookTitle?: string;
  chapter?: string;
  coreConcept?: string;
  extraContext?: string;
  accessCode?: string;
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: AnalyzeRequest;
  try {
    body = (await req.json()) as AnalyzeRequest;
  } catch {
    return jsonError(400, "요청 형식이 올바르지 않아요.");
  }

  const bookTitle = body.bookTitle?.trim();
  const chapter = body.chapter?.trim();
  const coreConcept = body.coreConcept?.trim();
  const extraContext = body.extraContext?.trim();

  if (!bookTitle || !chapter || !coreConcept) {
    return jsonError(400, "책 제목, 챕터, 핵심 개념을 모두 입력해줘.");
  }

  // Optional shared access code — gate the app if ACCESS_CODE is set.
  const requiredCode = process.env.ACCESS_CODE?.trim();
  if (requiredCode && body.accessCode?.trim() !== requiredCode) {
    return jsonError(401, "접속 코드가 맞지 않아.");
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return jsonError(
      500,
      "서버에 GOOGLE_AI_API_KEY가 설정되지 않았어. 배포 설정을 확인해줘.",
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const userMessage = buildUserMessage({
    bookTitle,
    chapter,
    coreConcept,
    extraContext,
  });

  // Track abort so the streaming loop can bail when the client disconnects.
  // The Gemini SDK doesn't take an explicit abort signal in this version,
  // so we just stop draining the iterator — the underlying socket closes
  // when we return from the loop.
  let aborted = false;
  req.signal.addEventListener("abort", () => {
    aborted = true;
  });

  let stream;
  try {
    // Flash gives ~1,500 free requests/day with strong Korean output —
    // plenty for a classroom. Swap to "gemini-2.5-pro" for the highest
    // quality at the cost of a tighter daily quota (~25/day on free tier).
    stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: userMessage,
      config: {
        systemInstruction: SYSTEM_PROMPT,
      },
    });
  } catch (err) {
    return jsonError(500, formatError(err));
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (aborted) break;
          const text = chunk.text;
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (err) {
        if (aborted) {
          controller.close();
          return;
        }
        // Mid-stream error: surface it inline so the client sees what
        // happened. The status code (200) is already locked in.
        controller.enqueue(
          encoder.encode(`\n\n[오류로 중단됨] ${formatError(err)}\n`),
        );
        controller.close();
      }
    },
    cancel() {
      aborted = true;
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("quota") || msg.includes("rate") || msg.includes("429")) {
      return "Gemini 무료 한도에 도달했어. 1~2분 후 다시 시도하거나, Google AI Studio에서 키를 새로 발급받아.";
    }
    if (
      msg.includes("api key") ||
      msg.includes("permission") ||
      msg.includes("401") ||
      msg.includes("403")
    ) {
      return "API 키 인증이 실패했어. GOOGLE_AI_API_KEY를 확인해줘.";
    }
    return err.message;
  }
  return "알 수 없는 오류";
}
