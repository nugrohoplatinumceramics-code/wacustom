"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Chat, Message, ImageAnnotation } from "@/types/whatsapp";

interface WhatsAppStore {
  // State
  chats: Chat[];
  messages: Record<string, Message[]>; // chatId -> messages
  activeChatId: string | null;
  searchQuery: string;
  replyingTo: Message | null;
  selectedImage: { url: string; messageId: string; chatId: string } | null;
  gowaBaseUrl: string;
  isConnected: boolean;

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

  // UI actions
  setReplyingTo: (message: Message | null) => void;
  setSelectedImage: (
    image: { url: string; messageId: string; chatId: string } | null
  ) => void;

  // Config
  setGowaBaseUrl: (url: string) => void;
  setIsConnected: (connected: boolean) => void;

  // Computed
  getFilteredChats: () => Chat[];
  getActiveChat: () => Chat | undefined;
  getMessages: (chatId: string) => Message[];
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
      gowaBaseUrl: "http://localhost:3000",
      isConnected: false,

      setChats: (chats) => set({ chats }),

      upsertChat: (chat) =>
        set((state) => {
          const existing = state.chats.findIndex((c) => c.id === chat.id);
          if (existing >= 0) {
            const updated = [...state.chats];
            updated[existing] = chat;
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

      setReplyingTo: (message) => set({ replyingTo: message }),

      setSelectedImage: (image) => set({ selectedImage: image }),

      setGowaBaseUrl: (url) => set({ gowaBaseUrl: url }),

      setIsConnected: (connected) => set({ isConnected: connected }),

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
    }),
    {
      name: "whatsapp-store",
      partialize: (state) => ({
        chats: state.chats,
        messages: state.messages,
        gowaBaseUrl: state.gowaBaseUrl,
      }),
    }
  )
);
