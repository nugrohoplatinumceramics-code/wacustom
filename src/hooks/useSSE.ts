"use client";

import { useEffect, useRef } from "react";
import { useWhatsAppStore } from "@/lib/store";
import type { Message, Chat } from "@/types/whatsapp";

interface SSEEvent {
  type: "connected" | "message";
  message?: Message;
  chat?: Chat;
}

export function useSSE() {
  const { addMessage, upsertChat, setIsConnected } = useWhatsAppStore();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function connect() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource("/api/webhook");
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      es.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);

          if (data.type === "connected") {
            setIsConnected(true);
          } else if (data.type === "message" && data.message && data.chat) {
            // Restore Date objects (they come as strings from JSON)
            const message: Message = {
              ...data.message,
              timestamp: new Date(data.message.timestamp),
            };
            const chat: Chat = {
              ...data.chat,
              updatedAt: new Date(data.chat.updatedAt),
              lastMessage: message,
            };

            addMessage(message);
            upsertChat(chat);
          }
        } catch (err) {
          console.error("SSE parse error:", err);
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        es.close();
        eventSourceRef.current = null;

        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    }

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [addMessage, upsertChat, setIsConnected]);
}
