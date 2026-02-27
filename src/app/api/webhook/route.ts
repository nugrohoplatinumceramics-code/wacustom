import { NextRequest, NextResponse } from "next/server";
import type { GowaWebhookPayload } from "@/types/whatsapp";
import { parseWebhookToMessage, parseWebhookToChat } from "@/lib/webhook-parser";

// In-memory event emitter for SSE clients
const sseClients = new Set<ReadableStreamDefaultController>();

export function broadcastToClients(data: unknown) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  for (const controller of sseClients) {
    try {
      controller.enqueue(encoder.encode(payload));
    } catch {
      sseClients.delete(controller);
    }
  }
}

// POST /api/webhook - Receive GOWA webhook
export async function POST(request: NextRequest) {
  try {
    const payload: GowaWebhookPayload = await request.json();

    // Parse the webhook payload
    const message = parseWebhookToMessage(payload);
    const chat = parseWebhookToChat(payload, message);

    // Broadcast to all SSE clients
    broadcastToClients({
      type: "message",
      message,
      chat,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

// GET /api/webhook - SSE endpoint for real-time updates
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      sseClients.add(controller);

      // Send initial connection message
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
      );
    },
    cancel(controller) {
      sseClients.delete(controller);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
