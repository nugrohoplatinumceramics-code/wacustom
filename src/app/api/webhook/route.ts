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

// GOWA v8 webhook wrapper format
interface GowaV8WebhookPayload {
  event: string;
  device_id: string;
  payload: GowaWebhookPayload;
}

// POST /api/webhook - Receive GOWA webhook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let payload: GowaWebhookPayload;

    // Handle GOWA v8 format: { event, device_id, payload: {...} }
    if (body.event && body.payload) {
      const v8Body = body as GowaV8WebhookPayload;
      payload = v8Body.payload;

      // Handle non-message events
      if (v8Body.event !== "message" && v8Body.event !== "message.reaction" && v8Body.event !== "message.revoked") {
        // Broadcast the raw event for other purposes
        broadcastToClients({
          type: "event",
          event: v8Body.event,
          deviceId: v8Body.device_id,
          data: v8Body.payload,
        });
        return NextResponse.json({ success: true });
      }
    } else {
      // Legacy format (direct payload)
      payload = body as GowaWebhookPayload;
    }

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

      // Keep-alive ping every 30 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "ping" })}\n\n`)
          );
        } catch {
          clearInterval(pingInterval);
          sseClients.delete(controller);
        }
      }, 30000);
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
