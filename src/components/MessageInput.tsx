"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Video,
  Mic,
  X,
  Smile,
  Check,
  Crop,
  Square,
  RotateCcw,
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

interface Rect {
  x: number; // pixel relative to rendered image
  y: number; // pixel relative to rendered image
  width: number; // pixel relative to rendered image
  height: number; // pixel relative to rendered image
}

interface DrawPoint {
  x: number; // pixel relative to rendered image
  y: number; // pixel relative to rendered image
}

interface DrawPath {
  points: DrawPoint[];
  sizePx: number; // pixel size on rendered image
  color: string;
}

interface ImageEditorProps {
  src: string;
  onApply: (nextFile: File, nextPreview: string) => void;
  onClose: () => void;
}

function ImageEditorModal({ src, onApply, onClose }: ImageEditorProps) {
  const [mode, setMode] = useState<"crop" | "spidol">("crop");
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  const [spidolPaths, setSpidolPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawPath | null>(null);
  const [spidolSizePx, setSpidolSizePx] = useState(6);
  const [spidolColor, setSpidolColor] = useState("#ef4444");
  const [drawing, setDrawing] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const syncImageSize = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;
    const width = img.clientWidth;
    const height = img.clientHeight;
    if (width > 0 && height > 0) {
      setImageSize({ width, height });
    }
  }, []);

  useEffect(() => {
    syncImageSize();
    const img = imageRef.current;
    if (!img) return;

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", syncImageSize);
      return () => window.removeEventListener("resize", syncImageSize);
    }

    const ro = new ResizeObserver(() => syncImageSize());
    ro.observe(img);
    return () => ro.disconnect();
  }, [syncImageSize]);

  const getPos = (e: React.MouseEvent) => {
    const img = imageRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return {
      x: Math.max(0, Math.min(x, rect.width)),
      y: Math.max(0, Math.min(y, rect.height)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getPos(e);
    if (mode === "crop") {
      setDrawing({
        startX: pos.x,
        startY: pos.y,
        currentX: pos.x,
        currentY: pos.y,
      });
      return;
    }

    const img = imageRef.current;
    if (!img) return;
    setCurrentPath({
      points: [{ x: pos.x, y: pos.y }],
      sizePx: spidolSizePx,
      color: spidolColor,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getPos(e);
    if (mode === "crop") {
      if (!drawing) return;
      setDrawing((prev) =>
        prev
          ? {
              ...prev,
              currentX: pos.x,
              currentY: pos.y,
            }
          : null
      );
      return;
    }

    if (!currentPath) return;
    setCurrentPath((prev) =>
      prev
        ? {
            ...prev,
            points: [...prev.points, { x: pos.x, y: pos.y }],
          }
        : null
    );
  };

  const handleMouseUp = () => {
    if (mode === "crop") {
      if (!drawing) return;
      const x = Math.min(drawing.startX, drawing.currentX);
      const y = Math.min(drawing.startY, drawing.currentY);
      const width = Math.abs(drawing.currentX - drawing.startX);
      const height = Math.abs(drawing.currentY - drawing.startY);
      if (width < 1 || height < 1) {
        setDrawing(null);
        return;
      }
      const rect: Rect = { x, y, width, height };
      setCropRect(rect);
      setDrawing(null);
      return;
    }

    if (!currentPath) return;
    if (currentPath.points.length > 1) {
      setSpidolPaths((prev) => [...prev, currentPath]);
    }
    setCurrentPath(null);
  };

  const handleApply = async () => {
    const img = imageRef.current;
    if (!img) return;
    setSaving(true);
    try {
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const renderedW = Math.max(1, img.clientWidth);
      const renderedH = Math.max(1, img.clientHeight);
      const scaleX = naturalW / renderedW;
      const scaleY = naturalH / renderedH;
      const scaleLine = (scaleX + scaleY) / 2;
      const crop = cropRect || { x: 0, y: 0, width: renderedW, height: renderedH };

      const sx = Math.round(crop.x * scaleX);
      const sy = Math.round(crop.y * scaleY);
      const sw = Math.max(1, Math.round(crop.width * scaleX));
      const sh = Math.max(1, Math.round(crop.height * scaleY));

      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      // Draw freehand spidol paths over cropped result.
      spidolPaths.forEach((path) => {
        const transformed = path.points
          .map((p) => ({
            x: (p.x - crop.x) * scaleX,
            y: (p.y - crop.y) * scaleY,
          }))
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
        if (transformed.length < 2) return;
        ctx.strokeStyle = path.color;
        ctx.lineWidth = Math.max(2, path.sizePx * scaleLine);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(transformed[0].x, transformed[0].y);
        for (let i = 1; i < transformed.length; i += 1) {
          ctx.lineTo(transformed[i].x, transformed[i].y);
        }
        ctx.stroke();
      });

      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
      );
      if (!blob) return;
      const file = new File([blob], `edited-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      onApply(file, dataUrl);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const previewRect = drawing
    ? {
        x: Math.min(drawing.startX, drawing.currentX),
        y: Math.min(drawing.startY, drawing.currentY),
        width: Math.abs(drawing.currentX - drawing.startX),
        height: Math.abs(drawing.currentY - drawing.startY),
      }
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-[#111b21] border border-[#2a3942] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[#202c33]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("crop")}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${mode === "crop" ? "bg-[#00a884] text-white" : "bg-[#2a3942] text-[#aebac1]"}`}
            >
              <Crop className="w-4 h-4" />
              Crop
            </button>
            <button
              onClick={() => setMode("spidol")}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${mode === "spidol" ? "bg-[#00a884] text-white" : "bg-[#2a3942] text-[#aebac1]"}`}
            >
              <Square className="w-4 h-4" />
              Spidol
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[#2a3942]"
            >
              <X className="w-4 h-4 text-[#aebac1]" />
            </button>
            <button
              onClick={handleApply}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-[#00a884] text-white text-sm hover:bg-[#00c49a] disabled:opacity-50 flex items-center gap-1"
            >
              <Check className="w-4 h-4" />
              {saving ? "Applying..." : "Apply"}
            </button>
          </div>
        </div>

        <div className="p-4">
          <p className="text-xs text-[#8696a0] mb-2">
            Drag on image to {mode === "crop" ? "set crop area" : "draw with spidol"}
          </p>
          {mode === "spidol" && (
            <div className="mb-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8696a0]">Size</span>
                <input
                  type="range"
                  min={2}
                  max={20}
                  value={spidolSizePx}
                  onChange={(e) => setSpidolSizePx(parseInt(e.target.value, 10))}
                />
              </div>
              <input
                type="color"
                value={spidolColor}
                onChange={(e) => setSpidolColor(e.target.value)}
                className="w-8 h-8 bg-transparent border-0 p-0"
              />
              <button
                onClick={() => setSpidolPaths((prev) => prev.slice(0, -1))}
                className="px-2 py-1 text-xs rounded bg-[#2a3942] text-[#e9edef] hover:bg-[#3b4a54]"
              >
                Undo
              </button>
              <button
                onClick={() => {
                  setSpidolPaths([]);
                  setCurrentPath(null);
                }}
                className="px-2 py-1 text-xs rounded bg-[#2a3942] text-[#e9edef] hover:bg-[#3b4a54] flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
            </div>
          )}
          <div
            className="relative inline-block"
            style={
              imageSize
                ? { width: `${imageSize.width}px`, height: `${imageSize.height}px` }
                : undefined
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={src}
              alt="Edit image"
              className="block max-w-full max-h-[70vh] object-contain select-none cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onLoad={syncImageSize}
              draggable={false}
            />

            {cropRect && (
              <div
                className="absolute border-2 border-[#00a884] bg-[#00a884]/10 pointer-events-none"
                style={{
                  left: `${cropRect.x}px`,
                  top: `${cropRect.y}px`,
                  width: `${cropRect.width}px`,
                  height: `${cropRect.height}px`,
                }}
              />
            )}

            {(spidolPaths.length > 0 || currentPath) && (
              <svg
                className="absolute inset-0 pointer-events-none"
                width={imageSize?.width || undefined}
                height={imageSize?.height || undefined}
              >
                {spidolPaths.map((path, i) => (
                  <polyline
                    key={`path-${i}`}
                    points={path.points.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={path.color}
                    strokeWidth={Math.max(1, path.sizePx)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {currentPath && (
                  <polyline
                    points={currentPath.points.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={currentPath.color}
                    strokeWidth={Math.max(1, currentPath.sizePx)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            )}

            {previewRect && (
              <div
                className="absolute border-2 pointer-events-none border-[#00a884] bg-[#00a884]/10"
                style={{
                  left: `${previewRect.x}px`,
                  top: `${previewRect.y}px`,
                  width: `${previewRect.width}px`,
                  height: `${previewRect.height}px`,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MessageInput({ chatId, phone }: MessageInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { replyingTo, setReplyingTo, addMessage, gowaBaseUrl, gowaDeviceId } =
    useWhatsAppStore();
  const quickEmojis = ["😀", "😂", "😍", "👍", "🙏", "🔥", "🎉", "❤️", "😊", "😭", "😎", "🤝"];

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

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    const imageItem = Array.from(items).find((item) =>
      item.type.startsWith("image/")
    );
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    e.preventDefault();
    setShowAttachMenu(false);
    setShowEmojiPicker(false);

    const preview = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read pasted image"));
      reader.readAsDataURL(file);
    }).catch(() => "");

    setPendingAttachment({
      file: new File([file], `pasted-${Date.now()}.png`, {
        type: file.type || "image/png",
      }),
      type: "image",
      preview,
      caption: "",
    });
    setShowImageEditor(true);
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
          image: "/send/image",
          document: "/send/file",
          video: "/send/video",
          audio: "/send/audio",
        };

        formData.append("endpoint", endpointMap[pendingAttachment.type]);
        if (gowaDeviceId) formData.append("deviceId", gowaDeviceId);
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
        setShowImageEditor(false);
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
            endpoint: "/send/message",
            deviceId: gowaDeviceId,
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
  }, [text, pendingAttachment, sending, phone, replyingTo, gowaBaseUrl, gowaDeviceId]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = (e.target.dataset.type as AttachmentType) || "document";
    let preview: string | undefined;

    if (type === "image") {
      // Persist image preview across page reload by storing data URL (not blob URL).
      preview = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
      }).catch(() => "");
    }

    setPendingAttachment({ file, type, preview, caption: "" });
    setShowImageEditor(type === "image" && Boolean(preview));
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
            {pendingAttachment.type === "image" && pendingAttachment.preview && (
              <button
                onClick={() => setShowImageEditor(true)}
                className="mt-2 px-2 py-1 text-xs rounded bg-[#2a3942] text-[#e9edef] hover:bg-[#3b4a54]"
              >
                Edit (Crop/Spidol)
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setPendingAttachment(null);
              setShowImageEditor(false);
            }}
            className="p-1 rounded-full hover:bg-[#2a3942]"
          >
            <X className="w-4 h-4 text-[#8696a0]" />
          </button>
        </div>
      )}

      {showImageEditor && pendingAttachment?.type === "image" && pendingAttachment.preview && (
        <ImageEditorModal
          src={pendingAttachment.preview}
          onApply={(nextFile, nextPreview) => {
            setPendingAttachment((prev) =>
              prev
                ? {
                    ...prev,
                    file: nextFile,
                    preview: nextPreview,
                  }
                : prev
            );
          }}
          onClose={() => setShowImageEditor(false)}
        />
      )}

      {/* Input area */}
      <div className="relative flex items-end gap-2 px-3 py-3">
        {/* Emoji button */}
        <button
          onClick={() => setShowEmojiPicker((v) => !v)}
          className="p-2 rounded-full hover:bg-[#2a3942] transition-colors flex-shrink-0"
        >
          <Smile className="w-6 h-6 text-[#8696a0]" />
        </button>

        {showEmojiPicker && (
          <div className="absolute bottom-20 left-3 z-20 bg-[#233138] border border-[#2a3942] rounded-xl p-2 grid grid-cols-6 gap-1 shadow-xl">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setText((prev) => `${prev}${emoji}`);
                  setShowEmojiPicker(false);
                  textareaRef.current?.focus();
                }}
                className="w-8 h-8 rounded-md hover:bg-[#2a3942] text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

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
            onPaste={handlePaste}
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
