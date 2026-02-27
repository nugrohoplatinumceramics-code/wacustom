"use client";

import { useState, useRef, useCallback } from "react";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Video,
  Mic,
  X,
  Smile,
} from "lucide-react";
import { useWhatsAppStore } from "@/lib/store";
import type { Message } from "@/types/whatsapp";
import { formatFileSize } from "@/lib/webhook-parser";

interface MessageInputProps {
  chatId: string;
  phone: string;
}

type AttachmentType = "image" | "document" | "video" | "audio";

interface PendingAttachment {
  file: File;
  type: AttachmentType;
  preview?: string;
  caption: string;
}

export function MessageInput({ chatId, phone }: MessageInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { replyingTo, setReplyingTo, addMessage, gowaBaseUrl } =
    useWhatsAppStore();

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-resize textarea
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const createOptimisticMessage = (
    type: Message["type"],
    overrides: Partial<Message> = {}
  ): Message => ({
    id: `temp-${Date.now()}`,
    chatId,
    fromMe: true,
    senderName: "Me",
    senderPhone: "me",
    type,
    timestamp: new Date(),
    status: "sent",
    ...overrides,
  });

  const handleSend = useCallback(async () => {
    if ((!text.trim() && !pendingAttachment) || sending) return;

    setSending(true);

    try {
      if (pendingAttachment) {
        // Send media
        const formData = new FormData();
        formData.append("gowaBaseUrl", gowaBaseUrl);
        formData.append("phone", phone);

        const endpointMap: Record<AttachmentType, string> = {
          image: "/api/send/image",
          document: "/api/send/document",
          video: "/api/send/video",
          audio: "/api/send/audio",
        };

        formData.append("endpoint", endpointMap[pendingAttachment.type]);
        formData.append(pendingAttachment.type, pendingAttachment.file);

        if (pendingAttachment.caption) {
          formData.append("caption", pendingAttachment.caption);
        }
        if (replyingTo) {
          formData.append("reply_message_id", replyingTo.id);
        }

        // Optimistic update
        const optimistic = createOptimisticMessage(pendingAttachment.type, {
          media: {
            caption: pendingAttachment.caption,
            fileName: pendingAttachment.file.name,
            fileSize: pendingAttachment.file.size,
            mimeType: pendingAttachment.file.type,
            localUrl: pendingAttachment.preview,
          },
          replyTo: replyingTo
            ? {
                messageId: replyingTo.id,
                text: replyingTo.text,
                type: replyingTo.type,
              }
            : undefined,
        });
        addMessage(optimistic);

        await fetch("/api/send/media", { method: "POST", body: formData });
        setPendingAttachment(null);
      } else {
        // Send text
        const optimistic = createOptimisticMessage("text", {
          text: text.trim(),
          replyTo: replyingTo
            ? {
                messageId: replyingTo.id,
                text: replyingTo.text,
                type: replyingTo.type,
              }
            : undefined,
        });
        addMessage(optimistic);

        await fetch("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gowaBaseUrl,
            endpoint: "/api/send/message",
            phone,
            message: text.trim(),
            ...(replyingTo ? { reply_message_id: replyingTo.id } : {}),
          }),
        });

        setText("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }

      setReplyingTo(null);
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setSending(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, pendingAttachment, sending, phone, replyingTo, gowaBaseUrl]);

  const handleFileSelect = (type: AttachmentType) => {
    setShowAttachMenu(false);
    if (fileInputRef.current) {
      const acceptMap: Record<AttachmentType, string> = {
        image: "image/*",
        document: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar",
        video: "video/*",
        audio: "audio/*",
      };
      fileInputRef.current.accept = acceptMap[type];
      fileInputRef.current.dataset.type = type;
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = (e.target.dataset.type as AttachmentType) || "document";
    let preview: string | undefined;

    if (type === "image") {
      preview = URL.createObjectURL(file);
    }

    setPendingAttachment({ file, type, preview, caption: "" });
    e.target.value = "";
  };

  return (
    <div className="bg-[#202c33] border-t border-[#2a3942]">
      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-3 px-4 py-2 bg-[#1f2c34] border-b border-[#2a3942]">
          <div className="flex-1 border-l-4 border-[#00a884] pl-3">
            <p className="text-xs text-[#00a884] font-medium">
              {replyingTo.fromMe ? "You" : replyingTo.senderName}
            </p>
            <p className="text-xs text-[#8696a0] truncate">
              {replyingTo.text ||
                (replyingTo.type === "image" ? "📷 Photo" : "📎 Attachment")}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-full hover:bg-[#2a3942]"
          >
            <X className="w-4 h-4 text-[#8696a0]" />
          </button>
        </div>
      )}

      {/* Attachment preview */}
      {pendingAttachment && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#1f2c34] border-b border-[#2a3942]">
          {pendingAttachment.preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pendingAttachment.preview}
              alt={pendingAttachment.file.name}
              className="w-16 h-16 object-cover rounded-lg"
            />
          ) : (
            <div className="w-16 h-16 bg-[#2a3942] rounded-lg flex items-center justify-center">
              <FileText className="w-8 h-8 text-[#8696a0]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#e9edef] truncate">
              {pendingAttachment.file.name}
            </p>
            <p className="text-xs text-[#8696a0]">
              {formatFileSize(pendingAttachment.file.size)}
            </p>
            <input
              type="text"
              placeholder="Add a caption..."
              value={pendingAttachment.caption}
              onChange={(e) =>
                setPendingAttachment((prev) =>
                  prev ? { ...prev, caption: e.target.value } : null
                )
              }
              className="mt-1 w-full bg-[#2a3942] text-sm text-[#e9edef] px-2 py-1 rounded outline-none placeholder-[#8696a0]"
            />
          </div>
          <button
            onClick={() => setPendingAttachment(null)}
            className="p-1 rounded-full hover:bg-[#2a3942]"
          >
            <X className="w-4 h-4 text-[#8696a0]" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 px-3 py-3">
        {/* Emoji button */}
        <button className="p-2 rounded-full hover:bg-[#2a3942] transition-colors flex-shrink-0">
          <Smile className="w-6 h-6 text-[#8696a0]" />
        </button>

        {/* Attachment button */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="p-2 rounded-full hover:bg-[#2a3942] transition-colors"
          >
            <Paperclip className="w-6 h-6 text-[#8696a0]" />
          </button>

          {showAttachMenu && (
            <div className="absolute bottom-12 left-0 bg-[#233138] rounded-xl shadow-xl py-2 min-w-[180px] z-10">
              <button
                onClick={() => handleFileSelect("image")}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#e9edef] hover:bg-[#2a3942] transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-white" />
                </div>
                Photos & Videos
              </button>
              <button
                onClick={() => handleFileSelect("document")}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#e9edef] hover:bg-[#2a3942] transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                Document
              </button>
              <button
                onClick={() => handleFileSelect("video")}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#e9edef] hover:bg-[#2a3942] transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                  <Video className="w-4 h-4 text-white" />
                </div>
                Video
              </button>
              <button
                onClick={() => handleFileSelect("audio")}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#e9edef] hover:bg-[#2a3942] transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-white" />
                </div>
                Audio
              </button>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Text input */}
        <div className="flex-1 bg-[#2a3942] rounded-lg px-4 py-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message"
            rows={1}
            className="w-full bg-transparent text-sm text-[#e9edef] placeholder-[#8696a0] outline-none resize-none leading-5"
            style={{ maxHeight: "120px" }}
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={sending || (!text.trim() && !pendingAttachment)}
          className="p-2.5 rounded-full bg-[#00a884] hover:bg-[#00c49a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          <Send className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}
