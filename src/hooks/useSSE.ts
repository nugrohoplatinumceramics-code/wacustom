"use client";

import { useEffect, useRef } from "react";
import { useWhatsAppStore } from "@/lib/store";
import type { Message, Chat } from "@/types/whatsapp";

interface SSEEvent {
  type: "connected" | "message" | "ping" | "event";
  message?: Message;
  chat?: Chat;
}

interface GowaDeviceInfo {
  id: string;
  state?: string;
}

interface GowaChatListItem {
  jid: string;
  name?: string;
  updated_at?: string;
  last_message_time?: string;
}

interface GowaChatMessageItem {
  id: string;
  chat_jid: string;
  sender_jid?: string;
  content?: string;
  timestamp?: string;
  is_from_me?: boolean;
  media_type?: string;
  filename?: string;
  url?: string;
  file_length?: number;
}

function inferMessageTypeFromMedia(mediaType?: string): Message["type"] {
  const mt = (mediaType || "").toLowerCase();
  if (!mt) return "text";
  if (mt.includes("image")) return "image";
  if (mt.includes("video")) return "video";
  if (mt.includes("audio")) return "audio";
  if (mt.includes("sticker") || mt.includes("webp")) return "sticker";
  return "document";
}

function normalizeText(value?: string): string {
  return (value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function placeholderTypeFromText(value?: string): Exclude<Message["type"], "text" | "reaction" | "revoked"> | null {
  const t = normalizeText(value);
  if (t === "image") return "image";
  if (t === "video") return "video";
  if (t === "audio") return "audio";
  if (t === "document" || t === "file") return "document";
  if (t === "sticker") return "sticker";
  return null;
}

function toDate(value?: string): Date {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function isRealChatJid(jid: string): boolean {
  return jid.endsWith("@s.whatsapp.net") || jid.endsWith("@g.us");
}

function isValidPrivateJid(jid: string): boolean {
  if (!jid.endsWith("@s.whatsapp.net")) return false;
  const user = jid.replace("@s.whatsapp.net", "");
  return /^\d{8,15}$/.test(user);
}

function isOnlineWaState(state: string | null | undefined): boolean {
  const normalized = (state || "").toLowerCase();
  return normalized === "connected" || normalized === "logged_in";
}

export function useSSE() {
  const {
    addMessage,
    upsertChat,
    setIsConnected,
    gowaBaseUrl,
    gowaDeviceId,
    setGowaDeviceId,
    setIsWhatsAppConnected,
    setChats,
    setMessages,
    activeChatId,
  } = useWhatsAppStore();
  const eventSourceRef = useRef<EventSource | null>(null);
  const historySyncKeyRef = useRef<string | null>(null);
  const notificationReadyRef = useRef(false);
  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());
  const avatarCacheRef = useRef<Map<string, string>>(new Map());

  async function fetchAvatarUrl(phoneJid: string, deviceId: string): Promise<string | undefined> {
    if (!isValidPrivateJid(phoneJid)) return undefined;
    if (avatarCacheRef.current.has(phoneJid)) {
      return avatarCacheRef.current.get(phoneJid) || undefined;
    }
    try {
      const params = new URLSearchParams({
        gowaBaseUrl,
        path: `/user/avatar?phone=${phoneJid}&is_preview=true`,
        deviceId,
      });
      const res = await fetch(`/api/gowa?${params.toString()}`);
      if (!res.ok) return undefined;
      const data = await res.json();
      const url: string | undefined = data?.results?.url;
      if (url) {
        avatarCacheRef.current.set(phoneJid, url);
        return url;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  function maybeNotify(message: Message, chatName?: string) {
    const ageMs = Date.now() - new Date(message.timestamp).getTime();
    const shouldNotify =
      !message.fromMe &&
      activeChatId !== message.chatId &&
      ageMs < 2 * 60 * 1000 &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      notificationReadyRef.current &&
      Notification.permission === "granted" &&
      !notifiedMessageIdsRef.current.has(message.id);

    if (!shouldNotify) return;

    const preview = message.text || (message.type === "image"
      ? "Photo"
      : message.type === "video"
        ? "Video"
        : message.type === "audio"
          ? "Audio"
          : message.type === "document"
            ? "Document"
            : "New message");

    new Notification(chatName || message.senderName || "WhatsApp", {
      body: preview,
      tag: message.chatId,
    });
    notifiedMessageIdsRef.current.add(message.id);
  }

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      notificationReadyRef.current = true;
      return;
    }
    if (Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        notificationReadyRef.current = permission === "granted";
      });
    }
  }, []);

  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    const es = new EventSource("/api/webhook");
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        setIsConnected(true);

        if (data.type === "message" && data.message && data.chat) {
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
          maybeNotify(message, chat.name);
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    // Let EventSource auto-reconnect natively.
    es.onerror = () => {
      // Don't immediately mark offline on transient reconnects.
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      setIsConnected(false);
    };
  }, [activeChatId, addMessage, upsertChat, setIsConnected]);

  useEffect(() => {
    let cancelled = false;

    async function resolveDeviceId(): Promise<string | null> {
      if (!gowaBaseUrl) return null;
      const configuredDevice = gowaDeviceId?.trim();
      if (configuredDevice) {
        const params = new URLSearchParams({
          gowaBaseUrl,
          path: `/devices/${configuredDevice}`,
          deviceId: configuredDevice,
        });
        const res = await fetch(`/api/gowa?${params.toString()}`);
        if (res.ok) return configuredDevice;
      }

      const listParams = new URLSearchParams({
        gowaBaseUrl,
        path: "/devices",
      });
      const listRes = await fetch(`/api/gowa?${listParams.toString()}`);
      const listData = await listRes.json();
      const devices: GowaDeviceInfo[] = Array.isArray(listData?.results) ? listData.results : [];
      const preferred =
        devices.find((d) => isOnlineWaState(d.state)) ||
        devices[0];

      if (preferred?.id && preferred.id !== configuredDevice) {
        setGowaDeviceId(preferred.id);
      }
      return preferred?.id || null;
    }

    async function syncInitialHistory() {
      if (!gowaBaseUrl) return;

      const deviceId = await resolveDeviceId();
      if (!deviceId || cancelled) return;

      const syncKey = `${gowaBaseUrl}|${deviceId}`;
      if (historySyncKeyRef.current === syncKey) return;

      const chatsParams = new URLSearchParams({
        gowaBaseUrl,
        path: "/chats?limit=30",
        deviceId,
      });
      const chatsRes = await fetch(`/api/gowa?${chatsParams.toString()}`);
      if (!chatsRes.ok) return;

      const chatsJson = await chatsRes.json();
      const chatItems: GowaChatListItem[] = Array.isArray(chatsJson?.results?.data)
        ? chatsJson.results.data
        : [];

      const filteredChats = chatItems.filter((c) => {
        if (!c?.jid || !isRealChatJid(c.jid)) return false;
        if (c.jid.endsWith("@s.whatsapp.net")) return isValidPrivateJid(c.jid);
        return true;
      });
      const mappedChats: Chat[] = [];

      await Promise.all(
        filteredChats.map(async (chatItem) => {
          const existingMessages = useWhatsAppStore.getState().messages[chatItem.jid] || [];
          const avatarUrl =
            chatItem.jid.endsWith("@s.whatsapp.net")
              ? await fetchAvatarUrl(chatItem.jid, deviceId)
              : undefined;
          const messageParams = new URLSearchParams({
            gowaBaseUrl,
            path: `/chat/${chatItem.jid}/messages?limit=30`,
            deviceId,
          });

          let historyMessages: Message[] = [];
          try {
            const messageRes = await fetch(`/api/gowa?${messageParams.toString()}`);
            if (messageRes.ok) {
              const messageJson = await messageRes.json();
              const rawMessages: GowaChatMessageItem[] = Array.isArray(messageJson?.results?.data)
                ? messageJson.results.data
                : [];

              historyMessages = rawMessages
                .map((m) => {
                  const type = inferMessageTypeFromMedia(m.media_type);
                  const timestamp = toDate(m.timestamp);
                  const fromMe = Boolean(m.is_from_me);
                  const placeholderType = fromMe ? placeholderTypeFromText(m.content) : null;
                  const nearbyLocalMedia = placeholderType
                    ? existingMessages.find((em) => {
                        if (!em.fromMe || em.isDeleted) return false;
                        if (em.type === "text" || !em.media) return false;
                        const delta = Math.abs(
                          new Date(em.timestamp).getTime() - timestamp.getTime()
                        );
                        return delta <= 2 * 60 * 1000;
                      })
                    : null;

                  const message: Message = {
                    id: m.id,
                    chatId: chatItem.jid,
                    fromMe,
                    senderName: fromMe ? "You" : (chatItem.name || m.sender_jid || chatItem.jid),
                    senderPhone: m.sender_jid || chatItem.jid,
                    type: nearbyLocalMedia?.type || type,
                    text: nearbyLocalMedia ? undefined : (m.content || undefined),
                    timestamp,
                    status: fromMe ? "sent" : "delivered",
                  };

                  if (nearbyLocalMedia?.media) {
                    message.media = nearbyLocalMedia.media;
                  }

                  if (type !== "text" && (m.url || m.filename || m.media_type)) {
                    message.media = {
                      url: m.url || undefined,
                      fileName: m.filename || undefined,
                      fileSize: m.file_length || undefined,
                      mimeType: m.media_type || undefined,
                    };
                  }

                  return message;
                })
                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            }
          } catch {
            // Skip this chat if message fetch fails.
          }

          if (cancelled) return;

          const lastMessage = historyMessages[historyMessages.length - 1];
          const updatedAt = toDate(chatItem.updated_at || chatItem.last_message_time || lastMessage?.timestamp?.toISOString());

          if (historyMessages.length === 0) {
            return;
          }

          const mappedChat: Chat = {
            id: chatItem.jid,
            name: chatItem.name || chatItem.jid,
            phone: chatItem.jid,
            isGroup: chatItem.jid.endsWith("@g.us"),
            groupId: chatItem.jid.endsWith("@g.us") ? chatItem.jid : undefined,
            lastMessage,
            unreadCount: 0,
            avatar: avatarUrl,
            updatedAt,
          };

          mappedChats.push(mappedChat);
          setMessages(chatItem.jid, historyMessages);
        })
      );

      if (cancelled || mappedChats.length === 0) return;
      setChats(
        mappedChats.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
      );
      historySyncKeyRef.current = syncKey;
    }

    syncInitialHistory().catch((err) => {
      console.error("Initial history sync failed:", err);
    });

    return () => {
      cancelled = true;
    };
  }, [gowaBaseUrl, gowaDeviceId, setChats, setGowaDeviceId, setMessages]);

  useEffect(() => {
    let cancelled = false;

    async function resolveDeviceIdForPolling(): Promise<string | null> {
      if (!gowaBaseUrl) return null;
      const configuredDevice = gowaDeviceId?.trim();
      if (configuredDevice) {
        const params = new URLSearchParams({
          gowaBaseUrl,
          path: `/devices/${configuredDevice}`,
          deviceId: configuredDevice,
        });
        const res = await fetch(`/api/gowa?${params.toString()}`);
        if (res.ok) return configuredDevice;
      }

      const listParams = new URLSearchParams({
        gowaBaseUrl,
        path: "/devices",
      });
      const listRes = await fetch(`/api/gowa?${listParams.toString()}`);
      const listData = await listRes.json();
      const devices: GowaDeviceInfo[] = Array.isArray(listData?.results) ? listData.results : [];
      const preferred = devices.find((d) => isOnlineWaState(d.state)) || devices[0];
      if (preferred?.id && preferred.id !== configuredDevice) {
        setGowaDeviceId(preferred.id);
      }
      return preferred?.id || null;
    }

    async function pollNewMessages() {
      if (!gowaBaseUrl) return;
      const deviceId = await resolveDeviceIdForPolling();
      if (!deviceId || cancelled) return;

      const chatsParams = new URLSearchParams({
        gowaBaseUrl,
        path: "/chats?limit=10",
        deviceId,
      });
      const chatsRes = await fetch(`/api/gowa?${chatsParams.toString()}`);
      if (!chatsRes.ok) return;
      const chatsJson = await chatsRes.json();
      const chatItems: GowaChatListItem[] = Array.isArray(chatsJson?.results?.data)
        ? chatsJson.results.data
        : [];

      const filteredChats = chatItems.filter((c) => {
        if (!c?.jid || !isRealChatJid(c.jid)) return false;
        if (c.jid.endsWith("@s.whatsapp.net")) return isValidPrivateJid(c.jid);
        return true;
      });

      await Promise.all(
        filteredChats.map(async (chatItem) => {
          const messageParams = new URLSearchParams({
            gowaBaseUrl,
            path: `/chat/${chatItem.jid}/messages?limit=5`,
            deviceId,
          });
          const messageRes = await fetch(`/api/gowa?${messageParams.toString()}`);
          if (!messageRes.ok) return;
          const messageJson = await messageRes.json();
          const rawMessages: GowaChatMessageItem[] = Array.isArray(messageJson?.results?.data)
            ? messageJson.results.data
            : [];

          const sortedMessages = rawMessages
            .map((m) => {
              const type = inferMessageTypeFromMedia(m.media_type);
              const timestamp = toDate(m.timestamp);
              const message: Message = {
                id: m.id,
                chatId: chatItem.jid,
                fromMe: Boolean(m.is_from_me),
                senderName: m.is_from_me ? "You" : (chatItem.name || m.sender_jid || chatItem.jid),
                senderPhone: m.sender_jid || chatItem.jid,
                type,
                text: m.content || undefined,
                timestamp,
                status: m.is_from_me ? "sent" : "delivered",
              };
              if (type !== "text" && (m.url || m.filename || m.media_type)) {
                message.media = {
                  url: m.url || undefined,
                  fileName: m.filename || undefined,
                  fileSize: m.file_length || undefined,
                  mimeType: m.media_type || undefined,
                };
              }
              return message;
            })
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

          for (const message of sortedMessages) {
            addMessage(message);
            maybeNotify(message, chatItem.name);
          }

          const lastMessage = sortedMessages[sortedMessages.length - 1];
          if (!lastMessage) return;

          upsertChat({
            id: chatItem.jid,
            name: chatItem.name || chatItem.jid,
            phone: chatItem.jid,
            isGroup: chatItem.jid.endsWith("@g.us"),
            groupId: chatItem.jid.endsWith("@g.us") ? chatItem.jid : undefined,
            lastMessage,
            unreadCount: 0,
            avatar: chatItem.jid.endsWith("@s.whatsapp.net")
              ? avatarCacheRef.current.get(chatItem.jid)
              : undefined,
            updatedAt: toDate(chatItem.updated_at || chatItem.last_message_time || lastMessage.timestamp.toISOString()),
          });
        })
      );
    }

    pollNewMessages().catch((err) => {
      console.error("Polling new messages failed:", err);
    });
    const interval = setInterval(() => {
      pollNewMessages().catch((err) => {
        console.error("Polling new messages failed:", err);
      });
    }, 6000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeChatId, addMessage, gowaBaseUrl, gowaDeviceId, setGowaDeviceId, upsertChat]);

  useEffect(() => {
    let cancelled = false;

    async function checkWhatsAppStatus() {
      if (!gowaBaseUrl || !gowaDeviceId) {
        setIsWhatsAppConnected(false);
        return;
      }

      try {
        const params = new URLSearchParams({
          gowaBaseUrl,
          path: `/devices/${gowaDeviceId}`,
          deviceId: gowaDeviceId,
        });
        const res = await fetch(`/api/gowa?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const state = data?.results?.state;
          if (!cancelled) {
            setIsWhatsAppConnected(isOnlineWaState(state));
          }
          return;
        }

        // Fallback: if selected device is invalid, detect whether any device is connected.
        const listParams = new URLSearchParams({
          gowaBaseUrl,
          path: "/devices",
        });
        const listRes = await fetch(`/api/gowa?${listParams.toString()}`);
        const listData = await listRes.json();
        const devices = Array.isArray(listData?.results) ? listData.results : [];
        const anyConnected = devices.some((d: { state?: string }) => isOnlineWaState(d?.state));
        if (!cancelled) {
          setIsWhatsAppConnected(anyConnected);
        }
      } catch {
        if (!cancelled) {
          setIsWhatsAppConnected(false);
        }
      }
    }

    checkWhatsAppStatus();
    const interval = setInterval(checkWhatsAppStatus, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [gowaBaseUrl, gowaDeviceId, setIsWhatsAppConnected]);
}
