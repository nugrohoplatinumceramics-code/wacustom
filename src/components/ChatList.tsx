"use client";

import { useState } from "react";
import { format, isToday, isYesterday } from "date-fns";
import {
  Search,
  MessageSquarePlus,
  MoreVertical,
  Pin,
  BellOff,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useWhatsAppStore } from "@/lib/store";
import type { Chat, Message } from "@/types/whatsapp";

function formatChatTime(date: Date): string {
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "dd/MM/yyyy");
}

function getLastMessagePreview(message?: Message): string {
  if (!message) return "";
  if (message.isDeleted) return "🚫 This message was deleted";

  switch (message.type) {
    case "text":
      return message.text || "";
    case "image":
      return `📷 ${message.media?.caption || "Photo"}`;
    case "video":
      return `🎥 ${message.media?.caption || "Video"}`;
    case "audio":
      return "🎵 Audio";
    case "document":
      return `📄 ${message.media?.fileName || "Document"}`;
    case "sticker":
      return "😊 Sticker";
    case "location":
      return "📍 Location";
    case "contact":
      return `👤 ${message.contact?.name || "Contact"}`;
    case "reaction":
      return `${message.reaction?.emoji} Reaction`;
    case "revoked":
      return "🚫 This message was deleted";
    default:
      return "";
  }
}

function ChatAvatar({ chat }: { chat: Chat }) {
  const initials = chat.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const colors = [
    "bg-emerald-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-red-500",
  ];
  const colorIndex =
    chat.name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    colors.length;

  return (
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${colors[colorIndex]}`}
    >
      {chat.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={chat.avatar}
          alt={chat.name}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        initials
      )}
    </div>
  );
}

interface ChatItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
}

function ChatItem({ chat, isActive, onClick }: ChatItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const { pinChat, muteChat } = useWhatsAppStore();

  return (
    <div
      className={`relative flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#2a3942] transition-colors ${
        isActive ? "bg-[#2a3942]" : ""
      }`}
      onClick={onClick}
    >
      <ChatAvatar chat={chat} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {chat.isPinned && (
              <Pin className="w-3 h-3 text-gray-400 flex-shrink-0" />
            )}
            <span className="font-medium text-[#e9edef] text-sm truncate">
              {chat.name}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {chat.isMuted && (
              <BellOff className="w-3 h-3 text-gray-400" />
            )}
            <span className="text-xs text-[#8696a0]">
              {chat.updatedAt ? formatChatTime(new Date(chat.updatedAt)) : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs text-[#8696a0] truncate flex-1">
            {chat.lastMessage?.fromMe && (
              <span className="mr-1">
                {chat.lastMessage.status === "read" ? (
                  <span className="text-[#53bdeb]">✓✓</span>
                ) : chat.lastMessage.status === "delivered" ? (
                  <span>✓✓</span>
                ) : (
                  <span>✓</span>
                )}
              </span>
            )}
            {getLastMessagePreview(chat.lastMessage)}
          </p>
          {chat.unreadCount > 0 && (
            <span className="ml-2 bg-[#00a884] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 font-medium">
              {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Context menu button */}
      <button
        className="absolute right-2 top-2 p-1 rounded-full hover:bg-[#3b4a54] opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
      >
        <MoreVertical className="w-4 h-4 text-[#8696a0]" />
      </button>

      {showMenu && (
        <div
          className="absolute right-2 top-8 z-50 bg-[#233138] rounded-lg shadow-xl py-1 min-w-[160px]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-2"
            onClick={() => {
              pinChat(chat.id);
              setShowMenu(false);
            }}
          >
            <Pin className="w-4 h-4" />
            {chat.isPinned ? "Unpin chat" : "Pin chat"}
          </button>
          <button
            className="w-full text-left px-4 py-2 text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-2"
            onClick={() => {
              muteChat(chat.id);
              setShowMenu(false);
            }}
          >
            <BellOff className="w-4 h-4" />
            {chat.isMuted ? "Unmute notifications" : "Mute notifications"}
          </button>
        </div>
      )}
    </div>
  );
}

export function ChatList() {
  const {
    getFilteredChats,
    activeChatId,
    setActiveChatId,
    searchQuery,
    setSearchQuery,
    isConnected,
  } = useWhatsAppStore();

  const chats = getFilteredChats();

  return (
    <div className="flex flex-col h-full bg-[#111b21] border-r border-[#2a3942]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#202c33]">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center">
            <span className="text-white font-bold text-sm">WA</span>
          </div>
          <div className="flex items-center gap-1">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-[#00a884]" />
            ) : (
              <WifiOff className="w-4 h-4 text-[#8696a0]" />
            )}
            <span className="text-xs text-[#8696a0]">
              {isConnected ? "Connected" : "Connecting..."}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-[#2a3942] transition-colors">
            <MessageSquarePlus className="w-5 h-5 text-[#aebac1]" />
          </button>
          <button className="p-2 rounded-full hover:bg-[#2a3942] transition-colors">
            <MoreVertical className="w-5 h-5 text-[#aebac1]" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 bg-[#111b21]">
        <div className="flex items-center gap-2 bg-[#202c33] rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-[#8696a0] flex-shrink-0" />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#e9edef] placeholder-[#8696a0] outline-none"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <MessageSquarePlus className="w-16 h-16 text-[#8696a0] mb-4" />
            <p className="text-[#8696a0] text-sm">
              {searchQuery
                ? "No chats found"
                : "No chats yet. Messages will appear here when received via webhook."}
            </p>
          </div>
        ) : (
          <div className="group">
            {chats.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                isActive={activeChatId === chat.id}
                onClick={() => setActiveChatId(chat.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
