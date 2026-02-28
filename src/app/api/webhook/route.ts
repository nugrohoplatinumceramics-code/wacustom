import { NextRequest, NextResponse } from "next/server";
import type { GowaWebhookPayload } from "@/types/whatsapp";
import { parseWebhookToMessage, parseWebhookToChat } from "@/lib/webhook-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory event emitter for SSE clients
const sseClients = new Map<string, (data: unknown) => Promise<void>>();

export function broadcastToClients(data: unknown) {
  for (const [clientId, send] of sseClients) {
    send(data).catch(() => {
      sseClients.delete(clientId);
    });
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
    let eventName: string | undefined;

    // Handle GOWA v8 format: { event, device_id, payload: {...} }
    if (body.event && body.payload) {
      const v8Body = body as GowaV8WebhookPayload;
      payload = v8Body.payload;
      eventName = v8Body.event;

      // Handle non-message events
      if (
        v8Body.event !== "message" &&
        v8Body.event !== "message.reaction" &&
        v8Body.event !== "message.revoked" &&
        v8Body.event !== "message.edited"
      ) {
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
    const message = parseWebhookToMessage(payload, { event: eventName });
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
export async function GET(request: NextRequest) {
  const clientId = crypto.randomUUID();
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const send = async (data: unknown) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  sseClients.set(clientId, send);
  await send({ type: "connected" });

  // Keep-alive ping every 10 seconds to avoid upstream idle timeouts.
  const pingInterval = setInterval(() => {
    send({ type: "ping" }).catch(() => {
      clearInterval(pingInterval);
      sseClients.delete(clientId);
      writer.close().catch(() => {});
    });
  }, 10000);

  request.signal.addEventListener("abort", () => {
    clearInterval(pingInterval);
    sseClients.delete(clientId);
    writer.close().catch(() => {});
  });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no",
    },
  });
}
