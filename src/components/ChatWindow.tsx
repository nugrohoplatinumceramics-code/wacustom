"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { format } from "date-fns";
import {
  Phone,
  Video,
  Search,
  MoreVertical,
  Reply,
  Download,
  MapPin,
  User,
  FileText,
  Play,
  Pencil,
  Trash2,
  Forward,
  X,
} from "lucide-react";
import { useWhatsAppStore } from "@/lib/store";
import { MessageInput } from "./MessageInput";
import type { Message, Chat } from "@/types/whatsapp";
import { formatFileSize } from "@/lib/webhook-parser";

// Helper function to download media
async function downloadMedia(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("Failed to download media:", error);
    // Fallback: open in new tab
    window.open(url, "_blank");
  }
}

function MessageStatus({ status }: { status: Message["status"] }) {
  if (status === "read") return <span className="text-[#53bdeb] text-xs">✓✓</span>;
  if (status === "delivered") return <span className="text-[#8696a0] text-xs">✓✓</span>;
  if (status === "sent") return <span className="text-[#8696a0] text-xs">✓</span>;
  return null;
}

function ReplyPreview({ replyTo }: { replyTo: NonNullable<Message["replyTo"]> }) {
  return (
    <div className="border-l-4 border-[#00a884] pl-2 mb-1 bg-black/10 rounded-r py-1 pr-2">
      <p className="text-xs text-[#00a884] font-medium">{replyTo.senderName || "Message"}</p>
      <p className="text-xs text-[#8696a0] truncate">
        {replyTo.text || (replyTo.type === "image" ? "📷 Photo" : "📎 Attachment")}
      </p>
    </div>
  );
}

interface MessageContextMenuProps {
  message: Message;
  onReply: () => void;
  onForward: () => void;
  onDelete: () => void;
  isMe: boolean;
}

function MessageContextMenu({ message, onReply, onForward, onDelete, isMe }: MessageContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (message.isDeleted) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-full hover:bg-[#2a3942] transition-colors"
      >
        <MoreVertical className="w-4 h-4 text-[#8696a0]" />
      </button>
      {isOpen && (
        <div className={`absolute ${isMe ? "right-0" : "left-0"} top-full mt-1 bg-[#233138] rounded-lg shadow-lg border border-[#2a3942] py-1 min-w-[160px] z-20`}>
          <button
            onClick={() => {
              onReply();
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-2"
          >
            <Reply className="w-4 h-4" />
            Reply
          </button>
          <button
            onClick={() => {
              onForward();
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-[#e9edef] hover:bg-[#2a3942] flex items-center gap-2"
          >
            <Forward className="w-4 h-4" />
            Forward
          </button>
          <div className="border-t border-[#2a3942] my-1" />
          <button
            onClick={() => {
              onDelete();
              setIsOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#2a3942] flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

interface ForwardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onForward: (chatId: string) => void;
  chats: Chat[];
  currentChatId: string;
}

function ForwardDialog({ isOpen, onClose, onForward, chats, currentChatId }: ForwardDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const filteredChats = chats.filter(
    (c) =>
      c.id !== currentChatId &&
      (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#111b21] rounded-lg w-full max-w-md mx-4 shadow-xl border border-[#2a3942]">
        <div className="flex items-center justify-between p-4 border-b border-[#2a3942]">
          <h3 className="text-lg font-medium text-[#e9edef]">Forward to</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[#2a3942] transition-colors"
          >
            <X className="w-5 h-5 text-[#8696a0]" />
          </button>
        </div>
        <div className="p-4">
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00a884]"
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="p-4 text-center text-[#8696a0]">
              {searchQuery ? "No contacts found" : "No other chats available"}
            </div>
          ) : (
            filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onForward(chat.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#202c33] transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-sm">
                    {chat.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#e9edef] truncate">
                    {chat.name}
                  </p>
                  <p className="text-xs text-[#8696a0] truncate">{chat.phone}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  onReply: (message: Message) => void;
  onForward: (message: Message) => void;
  onDelete: (message: Message) => void;
  onImageClick: (url: string, messageId: string, chatId: string) => void;
}

function MessageBubble({ message, onReply, onForward, onDelete, onImageClick }: MessageBubbleProps) {
  const isMe = message.fromMe;
  const time = format(new Date(message.timestamp), "HH:mm");

  const bubbleClass = isMe
    ? "bg-[#005c4b] text-[#e9edef] rounded-tl-2xl rounded-bl-2xl rounded-tr-sm rounded-br-2xl ml-auto"
    : "bg-[#202c33] text-[#e9edef] rounded-tr-2xl rounded-br-2xl rounded-tl-sm rounded-bl-2xl";

  if (message.isDeleted) {
    return (
      <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}>
        <div className={`max-w-[65%] px-3 py-2 ${bubbleClass} opacity-60`}>
          <p className="text-sm italic text-[#8696a0]">🚫 This message was deleted</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (message.type) {
      case "text":
        return (
          <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
        );

      case "image":
        return (
          <div>
            <div
              className="relative cursor-pointer group"
              onClick={() => {
                const url = message.media?.localUrl || message.media?.url || message.media?.data
                  ? `data:${message.media.mimeType};base64,${message.media.data}`
                  : "";
                if (url) onImageClick(url, message.id, message.chatId);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  message.media?.localUrl ||
                  message.media?.url ||
                  (message.media?.data
                    ? `data:${message.media.mimeType};base64,${message.media.data}`
                    : "")
                }
                alt={message.media?.caption || "Image"}
                className="max-w-full rounded-lg max-h-64 object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = message.media?.localUrl || message.media?.url ||
                        (message.media?.data ? `data:${message.media.mimeType};base64,${message.media.data}` : "");
                      if (url) {
                        downloadMedia(url, message.media?.fileName || `image-${message.id}.jpg`);
                      }
                    }}
                    className="bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors"
                  >
                    <Download className="w-4 h-4 text-white" />
                  </button>
                  <div className="bg-black/50 rounded-full p-2">
                    <Pencil className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>
              {message.annotations && message.annotations.length > 0 && (
                <div className="absolute top-2 right-2 bg-[#00a884] text-white text-xs px-1.5 py-0.5 rounded-full">
                  {message.annotations.length} mark
                </div>
              )}
            </div>
            {message.media?.caption && (
              <p className="text-sm mt-1">{message.media.caption}</p>
            )}
          </div>
        );

      case "video":
        return (
          <div>
            <div className="relative bg-black rounded-lg overflow-hidden max-h-64 flex items-center justify-center min-h-32 group">
              {message.media?.localUrl || message.media?.url ? (
                <>
                  <video
                    src={message.media.localUrl || message.media.url}
                    className="max-w-full max-h-64"
                    controls
                  />
                  <button
                    onClick={() => {
                      const url = message.media?.localUrl || message.media?.url;
                      if (url) {
                        downloadMedia(url, message.media?.fileName || `video-${message.id}.mp4`);
                      }
                    }}
                    className="absolute top-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Download className="w-4 h-4 text-white" />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 p-8">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Play className="w-6 h-6 text-white ml-1" />
                  </div>
                  <p className="text-xs text-white/70">Video</p>
                </div>
              )}
            </div>
            {message.media?.caption && (
              <p className="text-sm mt-1">{message.media.caption}</p>
            )}
          </div>
        );

      case "audio":
        return (
          <div className="flex items-center gap-3 min-w-48 group">
            <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center flex-shrink-0">
              <Play className="w-5 h-5 text-white ml-0.5" />
            </div>
            {message.media?.localUrl || message.media?.url ? (
              <audio
                src={message.media.localUrl || message.media.url}
                controls
                className="flex-1 h-8"
              />
            ) : (
              <div className="flex-1 h-1 bg-[#8696a0] rounded-full" />
            )}
            {(message.media?.localUrl || message.media?.url) && (
              <button
                onClick={() => {
                  const url = message.media?.localUrl || message.media?.url;
                  if (url) {
                    downloadMedia(url, message.media?.fileName || `audio-${message.id}.ogg`);
                  }
                }}
                className="p-1.5 rounded-full hover:bg-[#2a3942] opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Download className="w-4 h-4 text-[#8696a0]" />
              </button>
            )}
          </div>
        );

      case "document":
        return (
          <div className="flex items-center gap-3 min-w-48">
            <div className="w-10 h-10 rounded-lg bg-[#2a3942] flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-[#8696a0]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{message.media?.fileName || "Document"}</p>
              {message.media?.fileSize && (
                <p className="text-xs text-[#8696a0]">
                  {formatFileSize(message.media.fileSize)}
                </p>
              )}
            </div>
            {message.media?.url && (
              <a
                href={message.media.url}
                download={message.media.fileName}
                className="p-1.5 rounded-full hover:bg-[#2a3942]"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="w-4 h-4 text-[#8696a0]" />
              </a>
            )}
          </div>
        );

      case "location":
        return (
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#00a884] flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">
                {message.location?.name || "Location"}
              </p>
              {message.location?.address && (
                <p className="text-xs text-[#8696a0]">{message.location.address}</p>
              )}
              <a
                href={`https://maps.google.com/?q=${message.location?.latitude},${message.location?.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#53bdeb] hover:underline"
              >
                Open in Maps
              </a>
            </div>
          </div>
        );

      case "contact":
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2a3942] flex items-center justify-center">
              <User className="w-5 h-5 text-[#8696a0]" />
            </div>
            <div>
              <p className="text-sm font-medium">{message.contact?.name}</p>
              <p className="text-xs text-[#8696a0]">{message.contact?.phone}</p>
            </div>
          </div>
        );

      case "sticker":
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              message.media?.url ||
              (message.media?.data
                ? `data:${message.media.mimeType};base64,${message.media.data}`
                : "")
            }
            alt="Sticker"
            className="w-24 h-24 object-contain"
          />
        );

      default:
        return <p className="text-sm text-[#8696a0]">Unsupported message type</p>;
    }
  };

  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1 group`}>
      <div className="relative max-w-[65%]">
        {/* Action buttons on hover */}
        <div
          className={`absolute top-1 ${isMe ? "-left-20" : "-right-20"} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10`}
        >
          <button
            onClick={() => onReply(message)}
            className="p-1.5 rounded-full bg-[#202c33] hover:bg-[#2a3942] shadow"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5 text-[#8696a0]" />
          </button>
          <MessageContextMenu
            message={message}
            onReply={() => onReply(message)}
            onForward={() => onForward(message)}
            onDelete={() => onDelete(message)}
            isMe={isMe}
          />
        </div>

        <div className={`px-3 py-2 ${bubbleClass}`}>
          {/* Group sender name */}
          {!isMe && message.senderName && (
            <p className="text-xs text-[#00a884] font-medium mb-1">
              {message.senderName}
            </p>
          )}

          {/* Reply preview */}
          {message.replyTo && <ReplyPreview replyTo={message.replyTo} />}

          {/* Message content */}
          {renderContent()}

          {/* Time and status */}
          <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] text-[#8696a0]">{time}</span>
            {isMe && <MessageStatus status={message.status} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function DateDivider({ date }: { date: Date }) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let label: string;
  if (d.toDateString() === today.toDateString()) {
    label = "Today";
  } else if (d.toDateString() === yesterday.toDateString()) {
    label = "Yesterday";
  } else {
    label = format(d, "MMMM d, yyyy");
  }

  return (
    <div className="flex items-center justify-center my-4">
      <span className="bg-[#1f2c34] text-[#8696a0] text-xs px-3 py-1 rounded-full shadow">
        {label}
      </span>
    </div>
  );
}

export function ChatWindow() {
  const {
    activeChatId,
    getActiveChat,
    getMessages,
    setReplyingTo,
    setSelectedImage,
    deleteMessage,
    forwardMessage,
    chats,
  } = useWhatsAppStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chat = getActiveChat();
  const messages = activeChatId ? getMessages(activeChatId) : [];
  
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

  const handleForward = (message: Message) => {
    setForwardingMessage(message);
    setForwardDialogOpen(true);
  };

  const handleForwardToChat = (targetChatId: string) => {
    if (forwardingMessage && activeChatId) {
      forwardMessage(activeChatId, forwardingMessage.id, targetChatId);
    }
    setForwardDialogOpen(false);
    setForwardingMessage(null);
  };

  const handleDelete = (message: Message) => {
    if (activeChatId && confirm("Are you sure you want to delete this message?")) {
      deleteMessage(activeChatId, message.id);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (!activeChatId || !chat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0b141a]">
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-[#202c33] flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">💬</span>
          </div>
          <h2 className="text-2xl font-light text-[#e9edef] mb-2">
            WhatsApp Web Clone
          </h2>
          <p className="text-[#8696a0] text-sm max-w-sm">
            Select a chat to start messaging. Messages are received via GOWA webhook.
          </p>
        </div>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages: { date: Date; messages: Message[] }[] = [];
  let currentDate: string | null = null;

  for (const msg of messages) {
    const msgDate = new Date(msg.timestamp);
    const dateStr = msgDate.toDateString();
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      groupedMessages.push({ date: msgDate, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0b141a] overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#202c33] border-b border-[#2a3942]">
        <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-semibold text-sm">
            {chat.name.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-[#e9edef] text-sm truncate">{chat.name}</h3>
          <p className="text-xs text-[#8696a0] truncate">{chat.phone}</p>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-full hover:bg-[#2a3942] transition-colors">
            <Video className="w-5 h-5 text-[#aebac1]" />
          </button>
          <button className="p-2 rounded-full hover:bg-[#2a3942] transition-colors">
            <Phone className="w-5 h-5 text-[#aebac1]" />
          </button>
          <button className="p-2 rounded-full hover:bg-[#2a3942] transition-colors">
            <Search className="w-5 h-5 text-[#aebac1]" />
          </button>
          <button className="p-2 rounded-full hover:bg-[#2a3942] transition-colors">
            <MoreVertical className="w-5 h-5 text-[#aebac1]" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#8696a0] text-sm">No messages yet</p>
          </div>
        ) : (
          <>
            {groupedMessages.map((group, gi) => (
              <div key={gi}>
                <DateDivider date={group.date} />
                {group.messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onReply={setReplyingTo}
                    onForward={handleForward}
                    onDelete={handleDelete}
                    onImageClick={(url, messageId, chatId) =>
                      setSelectedImage({ url, messageId, chatId })
                    }
                  />
                ))}
              </div>
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <MessageInput chatId={chat.id} phone={chat.phone} />

      {/* Forward Dialog */}
      <ForwardDialog
        isOpen={forwardDialogOpen}
        onClose={() => {
          setForwardDialogOpen(false);
          setForwardingMessage(null);
        }}
        onForward={handleForwardToChat}
        chats={chats}
        currentChatId={activeChatId}
      />
    </div>
  );
}
