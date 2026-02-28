"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { format, isToday, isYesterday } from "date-fns";
import {
  Search,
  MessageSquarePlus,
  MoreVertical,
  Pin,
  BellOff,
  Wifi,
  WifiOff,
  Smartphone,
  X,
} from "lucide-react";
import { useWhatsAppStore } from "@/lib/store";
import type { Chat, Message } from "@/types/whatsapp";
import { SettingsPanel } from "./SettingsPanel";

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

interface ContactEntry {
  jid: string;
  name: string;
}

function normalizePhoneToJid(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  if (digits.length < 8) return null;
  return `${digits}@s.whatsapp.net`;
}

interface NewMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gowaBaseUrl: string;
  gowaDeviceId: string;
  onSelectContact: (jid: string, name?: string) => void;
}

function NewMessageDialog({
  isOpen,
  onClose,
  gowaBaseUrl,
  gowaDeviceId,
  onSelectContact,
}: NewMessageDialogProps) {
  const [query, setQuery] = useState("");
  const [manualNumber, setManualNumber] = useState("");
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts.slice(0, 100);
    return contacts
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.jid.toLowerCase().includes(q) ||
          c.jid.replace("@s.whatsapp.net", "").includes(q)
      )
      .slice(0, 100);
  }, [contacts, query]);

  const fetchContacts = async () => {
    if (!gowaBaseUrl || !gowaDeviceId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        gowaBaseUrl,
        path: "/user/my/contacts",
        deviceId: gowaDeviceId,
      });
      const res = await fetch(`/api/gowa?${params.toString()}`);
      const data = await res.json();
      const list = Array.isArray(data?.results?.data) ? data.results.data : [];
      const mapped = list
        .map((it: { jid?: string; name?: string }) => ({
          jid: it.jid || "",
          name: it.name || "",
        }))
        .filter((it: ContactEntry) => it.jid.endsWith("@s.whatsapp.net"));
      const unique = new Map<string, ContactEntry>();
      mapped.forEach((it: ContactEntry) => {
        if (!unique.has(it.jid)) unique.set(it.jid, it);
      });
      setContacts([...unique.values()]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#111b21] border border-[#2a3942] rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between">
          <h3 className="text-[#e9edef] text-sm font-medium">New message</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[#2a3942] text-[#aebac1]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contact"
              className="flex-1 bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none"
            />
            <button
              onClick={fetchContacts}
              className="px-3 py-2 rounded-lg bg-[#00a884] text-white text-sm hover:bg-[#00c49a]"
            >
              {loading ? "Loading..." : "Load"}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto border border-[#2a3942] rounded-lg">
            {filteredContacts.length === 0 ? (
              <p className="text-xs text-[#8696a0] px-3 py-4 text-center">
                {loading ? "Loading contacts..." : "No contacts found"}
              </p>
            ) : (
              filteredContacts.map((c) => (
                <button
                  key={c.jid}
                  onClick={() => {
                    onSelectContact(c.jid, c.name);
                    onClose();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#202c33] border-b border-[#1f2c34] last:border-b-0"
                >
                  <p className="text-sm text-[#e9edef] truncate">{c.name || c.jid}</p>
                  <p className="text-xs text-[#8696a0]">{c.jid.replace("@s.whatsapp.net", "")}</p>
                </button>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-[#2a3942]">
            <p className="text-xs text-[#8696a0] mb-2">Or input number manually</p>
            <div className="flex gap-2">
              <input
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                placeholder="e.g. 628123456789"
                className="flex-1 bg-[#2a3942] text-[#e9edef] text-sm rounded-lg px-3 py-2 outline-none"
              />
              <button
                onClick={() => {
                  const jid = normalizePhoneToJid(manualNumber);
                  if (!jid) return;
                  onSelectContact(jid, manualNumber.replace(/[^\d]/g, ""));
                  onClose();
                }}
                className="px-3 py-2 rounded-lg bg-[#00a884] text-white text-sm hover:bg-[#00c49a]"
              >
                Start
              </button>
            </div>
          </div>
        </div>
      </div>
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
      className={`relative flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#2a3942] transition-colors ${isActive ? "bg-[#2a3942]" : ""
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
    isWhatsAppConnected,
    upsertChat,
    gowaBaseUrl,
    gowaDeviceId,
  } = useWhatsAppStore();
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  const chats = getFilteredChats();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setShowHeaderMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openChatFromContact = (jid: string, name?: string) => {
    const isGroup = jid.endsWith("@g.us");
    upsertChat({
      id: jid,
      name: name || jid,
      phone: jid,
      isGroup,
      groupId: isGroup ? jid : undefined,
      unreadCount: 0,
      updatedAt: new Date(),
    });
    setActiveChatId(jid);
  };

  return (
    <div className="flex flex-col h-full bg-[#111b21] border-r border-[#2a3942]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#202c33]">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center">
            <span className="text-white font-bold text-sm">WA</span>
          </div>
          <div className="flex items-center gap-2">
            {/* SSE status */}
            <div
              className="flex items-center gap-1"
              title={isConnected ? "Server SSE: terhubung" : "Server SSE: terputus, reconnecting..."}
            >
              {isConnected ? (
                <Wifi className="w-3.5 h-3.5 text-[#00a884]" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-[#8696a0]" />
              )}
              <span className={`text-xs ${isConnected ? "text-[#00a884]" : "text-[#8696a0]"}`}>
                SSE
              </span>
            </div>
            {/* Separator */}
            <span className="text-[#3b4a54] text-xs">|</span>
            {/* WhatsApp status */}
            <div
              className="flex items-center gap-1"
              title={isWhatsAppConnected ? "WhatsApp: terhubung" : "WhatsApp: belum login. Buka Settings untuk scan QR."}
            >
              <Smartphone
                className={`w-3.5 h-3.5 ${isWhatsAppConnected ? "text-[#00a884]" : "text-[#8696a0]"
                  }`}
              />
              <span
                className={`text-xs ${isWhatsAppConnected ? "text-[#00a884]" : "text-[#8696a0]"
                  }`}
              >
                WA
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNewMessageOpen(true)}
            className="p-2 rounded-full hover:bg-[#2a3942] transition-colors"
            title="New message"
          >
            <MessageSquarePlus className="w-5 h-5 text-[#aebac1]" />
          </button>
          <div className="relative" ref={headerMenuRef}>
            <button
              className="p-2 rounded-full hover:bg-[#2a3942] transition-colors"
              onClick={() => setShowHeaderMenu((v) => !v)}
              title="Menu"
            >
              <MoreVertical className="w-5 h-5 text-[#aebac1]" />
            </button>
            {showHeaderMenu && (
              <div className="absolute right-0 top-10 z-50 bg-[#233138] rounded-lg shadow-xl py-1 min-w-[180px] border border-[#2a3942]">
                <SettingsPanel
                  triggerVariant="menu-item"
                  onTriggerClick={() => setShowHeaderMenu(false)}
                />
              </div>
            )}
          </div>
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

      <NewMessageDialog
        isOpen={newMessageOpen}
        onClose={() => setNewMessageOpen(false)}
        gowaBaseUrl={gowaBaseUrl}
        gowaDeviceId={gowaDeviceId}
        onSelectContact={openChatFromContact}
      />
    </div>
  );
}
