"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Chat, Message, ImageAnnotation } from "@/types/whatsapp";

// Backup data types
export interface BackupData {
  version: string;
  exportedAt: string;
  chats: Chat[];
  messages: Record<string, Message[]>;
  media: Record<string, string>; // messageId -> base64 data
}

interface WhatsAppStore {
  // State
  chats: Chat[];
  messages: Record<string, Message[]>; // chatId -> messages
  activeChatId: string | null;
  searchQuery: string;
  replyingTo: Message | null;
  selectedImage: { url: string; messageId: string; chatId: string } | null;
  gowaBaseUrl: string;
  gowaDeviceId: string;
  isConnected: boolean; // SSE browser → server connection
  isWhatsAppConnected: boolean; // GOWA device → WhatsApp connection

  // Chat actions
  setChats: (chats: Chat[]) => void;
  upsertChat: (chat: Chat) => void;
  setActiveChatId: (chatId: string | null) => void;
  setSearchQuery: (query: string) => void;
  markChatAsRead: (chatId: string) => void;
  pinChat: (chatId: string) => void;
  muteChat: (chatId: string) => void;

  // Message actions
  setMessages: (chatId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessageStatus: (
    chatId: string,
    messageId: string,
    status: Message["status"]
  ) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  forwardMessage: (fromChatId: string, messageId: string, toChatId: string) => void;
  addAnnotation: (
    chatId: string,
    messageId: string,
    annotation: ImageAnnotation
  ) => void;
  removeAnnotation: (
    chatId: string,
    messageId: string,
    annotationId: string
  ) => void;
  clearAnnotations: (chatId: string, messageId: string) => void;

  // UI actions
  setReplyingTo: (message: Message | null) => void;
  setSelectedImage: (
    image: { url: string; messageId: string; chatId: string } | null
  ) => void;

  // Config
  setGowaBaseUrl: (url: string) => void;
  setGowaDeviceId: (deviceId: string) => void;
  setIsConnected: (connected: boolean) => void;
  setIsWhatsAppConnected: (connected: boolean) => void;

  // Computed
  getFilteredChats: () => Chat[];
  getActiveChat: () => Chat | undefined;
  getMessages: (chatId: string) => Message[];

  // Backup & Restore
  exportBackup: () => Promise<BackupData>;
  importBackup: (data: BackupData) => void;
  clearAllData: () => void;
}

export const useWhatsAppStore = create<WhatsAppStore>()(
  persist(
    (set, get) => ({
      chats: [],
      messages: {},
      activeChatId: null,
      searchQuery: "",
      replyingTo: null,
      selectedImage: null,
      gowaBaseUrl: "http://localhost:3001",
      gowaDeviceId: "default",
      isConnected: false,
      isWhatsAppConnected: false,

      setChats: (chats) => set({ chats }),

      upsertChat: (chat) =>
        set((state) => {
          const existing = state.chats.findIndex((c) => c.id === chat.id);
          if (existing >= 0) {
            const updated = [...state.chats];
            const prev = updated[existing];
            // Keep unread counter from state updates done by addMessage(),
            // and only use incoming unread count when there was no unread before.
            updated[existing] = {
              ...prev,
              ...chat,
              unreadCount:
                prev.unreadCount > 0
                  ? prev.unreadCount
                  : chat.unreadCount,
            };
            return {
              chats: updated.sort(
                (a, b) =>
                  new Date(b.updatedAt).getTime() -
                  new Date(a.updatedAt).getTime()
              ),
            };
          }
          return {
            chats: [chat, ...state.chats].sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            ),
          };
        }),

      setActiveChatId: (chatId) => {
        set({ activeChatId: chatId });
        if (chatId) {
          get().markChatAsRead(chatId);
        }
      },

      setSearchQuery: (query) => set({ searchQuery: query }),

      markChatAsRead: (chatId) =>
        set((state) => ({
          chats: state.chats.map((c) =>
            c.id === chatId ? { ...c, unreadCount: 0 } : c
          ),
        })),

      pinChat: (chatId) =>
        set((state) => ({
          chats: state.chats.map((c) =>
            c.id === chatId ? { ...c, isPinned: !c.isPinned } : c
          ),
        })),

      muteChat: (chatId) =>
        set((state) => ({
          chats: state.chats.map((c) =>
            c.id === chatId ? { ...c, isMuted: !c.isMuted } : c
          ),
        })),

      setMessages: (chatId, messages) =>
        set((state) => ({
          messages: { ...state.messages, [chatId]: messages },
        })),

      addMessage: (message) =>
        set((state) => {
          const chatMessages = state.messages[message.chatId] || [];
          const exists = chatMessages.some((m) => m.id === message.id);
          if (exists) return state;

          // Some gateways emit an extra text message like "Image" right after media send.
          // Ignore that placeholder when we already have a recent outgoing media message.
          const normalizedText = (message.text || "")
            .normalize("NFKC")
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .replace(/\s+/g, " ")
            .trim();
          const isPlaceholderText =
            message.fromMe &&
            message.type === "text" &&
            /^(image|video|audio|document|file|sticker)$/.test(normalizedText);
          if (isPlaceholderText) {
            const hasRecentOutgoingMedia = [...chatMessages]
              .reverse()
              .some((m) => {
                if (!m.fromMe || m.type === "text" || m.isDeleted) return false;
                const delta =
                  Math.abs(
                    new Date(message.timestamp).getTime() -
                    new Date(m.timestamp).getTime()
                  );
                return delta <= 120000;
              });
            if (hasRecentOutgoingMedia) return state;
          }

          const updatedMessages = [...chatMessages, message].sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          // Update chat's last message and unread count
          const updatedChats = state.chats.map((c) => {
            if (c.id === message.chatId) {
              const isActive = state.activeChatId === message.chatId;
              return {
                ...c,
                lastMessage: message,
                unreadCount:
                  !message.fromMe && !isActive
                    ? c.unreadCount + 1
                    : c.unreadCount,
                updatedAt: message.timestamp,
              };
            }
            return c;
          });

          // If chat doesn't exist yet, create it
          const chatExists = state.chats.some((c) => c.id === message.chatId);
          if (!chatExists) {
            const newChat: Chat = {
              id: message.chatId,
              name: message.senderName || message.senderPhone,
              phone: message.senderPhone,
              isGroup: false,
              lastMessage: message,
              unreadCount: message.fromMe ? 0 : 1,
              updatedAt: message.timestamp,
            };
            updatedChats.push(newChat);
          }

          return {
            messages: {
              ...state.messages,
              [message.chatId]: updatedMessages,
            },
            chats: updatedChats.sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            ),
          };
        }),

      updateMessageStatus: (chatId, messageId, status) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map((m) =>
              m.id === messageId ? { ...m, status } : m
            ),
          },
        })),

      deleteMessage: (chatId, messageId) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map((m) =>
              m.id === messageId ? { ...m, isDeleted: true } : m
            ),
          },
        })),

      forwardMessage: (fromChatId, messageId, toChatId) =>
        set((state) => {
          const originalMessage = state.messages[fromChatId]?.find(
            (m) => m.id === messageId
          );
          if (!originalMessage) return state;

          // Create forwarded message with new ID and timestamp
          const forwardedMessage: Message = {
            ...originalMessage,
            id: `forward-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            chatId: toChatId,
            timestamp: new Date(),
            fromMe: true,
            status: "sent",
            replyTo: undefined, // Don't carry over reply context
          };

          const targetMessages = state.messages[toChatId] || [];
          const updatedMessages = [...targetMessages, forwardedMessage].sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          // Update target chat's last message
          const updatedChats = state.chats.map((c) => {
            if (c.id === toChatId) {
              return {
                ...c,
                lastMessage: forwardedMessage,
                updatedAt: forwardedMessage.timestamp,
              };
            }
            return c;
          });

          return {
            messages: {
              ...state.messages,
              [toChatId]: updatedMessages,
            },
            chats: updatedChats.sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            ),
          };
        }),

      addAnnotation: (chatId, messageId, annotation) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map((m) =>
              m.id === messageId
                ? { ...m, annotations: [...(m.annotations || []), annotation] }
                : m
            ),
          },
        })),

      removeAnnotation: (chatId, messageId, annotationId) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map((m) =>
              m.id === messageId
                ? {
                  ...m,
                  annotations: (m.annotations || []).filter(
                    (a) => a.id !== annotationId
                  ),
                }
                : m
            ),
          },
        })),

      clearAnnotations: (chatId, messageId) =>
        set((state) => ({
          messages: {
            ...state.messages,
            [chatId]: (state.messages[chatId] || []).map((m) =>
              m.id === messageId ? { ...m, annotations: [] } : m
            ),
          },
        })),

      setReplyingTo: (message) => set({ replyingTo: message }),

      setSelectedImage: (image) => set({ selectedImage: image }),

      setGowaBaseUrl: (url) => set({ gowaBaseUrl: url }),

      setGowaDeviceId: (deviceId) => set({ gowaDeviceId: deviceId }),

      setIsConnected: (connected) => set({ isConnected: connected }),

      setIsWhatsAppConnected: (connected) => set({ isWhatsAppConnected: connected }),

      getFilteredChats: () => {
        const { chats, searchQuery } = get();
        if (!searchQuery) return chats;
        const q = searchQuery.toLowerCase();
        return chats.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q)
        );
      },

      getActiveChat: () => {
        const { chats, activeChatId } = get();
        return chats.find((c) => c.id === activeChatId);
      },

      getMessages: (chatId) => {
        return get().messages[chatId] || [];
      },

      // Backup & Restore implementation
      exportBackup: async () => {
        const state = get();
        const media: Record<string, string> = {};

        // Collect all media data from messages
        for (const chatId in state.messages) {
          for (const msg of state.messages[chatId]) {
            if (msg.media?.data) {
              media[msg.id] = msg.media.data;
            }
          }
        }

        return {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          chats: state.chats,
          messages: state.messages,
          media,
        };
      },

      importBackup: (data) => {
        // Restore messages with media data
        const restoredMessages: Record<string, Message[]> = {};

        for (const chatId in data.messages) {
          restoredMessages[chatId] = data.messages[chatId].map((msg) => {
            // Restore media data if available
            if (data.media[msg.id] && msg.media) {
              return {
                ...msg,
                media: {
                  ...msg.media,
                  data: data.media[msg.id],
                },
              };
            }
            return msg;
          });
        }

        set({
          chats: data.chats,
          messages: restoredMessages,
        });
      },

      clearAllData: () => {
        set({
          chats: [],
          messages: {},
          activeChatId: null,
          replyingTo: null,
        });
      },
    }),
    {
      name: "whatsapp-store",
      partialize: (state) => ({
        chats: state.chats,
        messages: state.messages,
        gowaBaseUrl: state.gowaBaseUrl,
        gowaDeviceId: state.gowaDeviceId,
      }),
    }
  )
);
