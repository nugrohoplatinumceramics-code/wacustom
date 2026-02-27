"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, ZoomIn, ZoomOut, Download, Pencil, Trash2, RotateCcw } from "lucide-react";
import { useWhatsAppStore } from "@/lib/store";
import type { ImageAnnotation } from "@/types/whatsapp";

const ANNOTATION_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ec4899", // pink
];

interface DrawingRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function ImageViewer() {
  const { selectedImage, setSelectedImage, addAnnotation, removeAnnotation, messages } =
    useWhatsAppStore();

  const [zoom, setZoom] = useState(1);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0]);
  const [drawing, setDrawing] = useState<DrawingRect | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [pendingAnnotation, setPendingAnnotation] = useState<Omit<ImageAnnotation, "id" | "createdAt"> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const currentMessage = selectedImage
    ? messages[selectedImage.chatId]?.find((m) => m.id === selectedImage.messageId)
    : null;

  const annotations = currentMessage?.annotations || [];

  const handleClose = useCallback(() => {
    setSelectedImage(null);
    setZoom(1);
    setIsAnnotating(false);
    setDrawing(null);
    setPendingAnnotation(null);
  }, [setSelectedImage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  const getRelativePosition = (e: React.MouseEvent) => {
    const img = imageRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isAnnotating) return;
    e.preventDefault();
    const pos = getRelativePosition(e);
    setDrawing({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing || !isAnnotating) return;
    const pos = getRelativePosition(e);
    setDrawing((prev) => prev ? { ...prev, endX: pos.x, endY: pos.y } : null);
  };

  const handleMouseUp = () => {
    if (!drawing || !isAnnotating) return;
    const minX = Math.min(drawing.startX, drawing.endX);
    const minY = Math.min(drawing.startY, drawing.endY);
    const width = Math.abs(drawing.endX - drawing.startX);
    const height = Math.abs(drawing.endY - drawing.startY);

    if (width > 1 && height > 1) {
      setPendingAnnotation({
        x: minX,
        y: minY,
        width,
        height,
        color: selectedColor,
      });
    }
    setDrawing(null);
  };

  const confirmAnnotation = () => {
    if (!pendingAnnotation || !selectedImage) return;
    const annotation: ImageAnnotation = {
      ...pendingAnnotation,
      id: `ann-${Date.now()}`,
      label: labelInput || undefined,
      createdAt: new Date(),
    };
    addAnnotation(selectedImage.chatId, selectedImage.messageId, annotation);
    setPendingAnnotation(null);
    setLabelInput("");
  };

  const cancelAnnotation = () => {
    setPendingAnnotation(null);
    setLabelInput("");
  };

  if (!selectedImage) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1f2c34]">
        <div className="flex items-center gap-3">
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-[#2a3942] transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <span className="text-white text-sm font-medium">Image Viewer</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            className="p-2 rounded-full hover:bg-[#2a3942] transition-colors"
          >
            <ZoomOut className="w-5 h-5 text-white" />
          </button>
          <span className="text-white text-sm w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            className="p-2 rounded-full hover:bg-[#2a3942] transition-colors"
          >
            <ZoomIn className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-2 rounded-full hover:bg-[#2a3942] transition-colors"
          >
            <RotateCcw className="w-4 h-4 text-white" />
          </button>

          {/* Annotate toggle */}
          <button
            onClick={() => setIsAnnotating(!isAnnotating)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isAnnotating
                ? "bg-[#00a884] text-white"
                : "bg-[#2a3942] text-[#aebac1] hover:bg-[#3b4a54]"
            }`}
          >
            <Pencil className="w-4 h-4" />
            {isAnnotating ? "Annotating" : "Annotate"}
          </button>

          {/* Download */}
          <a
            href={selectedImage.url}
            download
            className="p-2 rounded-full hover:bg-[#2a3942] transition-colors"
          >
            <Download className="w-5 h-5 text-white" />
          </a>
        </div>
      </div>

      {/* Annotation color picker */}
      {isAnnotating && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#1f2c34] border-t border-[#2a3942]">
          <span className="text-[#8696a0] text-xs">Color:</span>
          {ANNOTATION_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setSelectedColor(color)}
              className={`w-6 h-6 rounded-full transition-transform ${
                selectedColor === color ? "scale-125 ring-2 ring-white" : ""
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
          <span className="text-[#8696a0] text-xs ml-2">
            Draw a rectangle on the image to annotate
          </span>
        </div>
      )}

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-4"
      >
        <div
          className="relative inline-block"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={selectedImage.url}
            alt="Preview"
            className={`max-w-full max-h-[70vh] object-contain select-none ${
              isAnnotating ? "cursor-crosshair" : "cursor-default"
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            draggable={false}
          />

          {/* Existing annotations */}
          {annotations.map((ann) => (
            <div
              key={ann.id}
              className="absolute group"
              style={{
                left: `${ann.x}%`,
                top: `${ann.y}%`,
                width: `${ann.width}%`,
                height: `${ann.height}%`,
                border: `2px solid ${ann.color}`,
                backgroundColor: `${ann.color}20`,
              }}
            >
              {ann.label && (
                <span
                  className="absolute -top-5 left-0 text-xs px-1 py-0.5 rounded text-white whitespace-nowrap"
                  style={{ backgroundColor: ann.color }}
                >
                  {ann.label}
                </span>
              )}
              <button
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                onClick={() =>
                  selectedImage &&
                  removeAnnotation(selectedImage.chatId, selectedImage.messageId, ann.id)
                }
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Drawing preview */}
          {drawing && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${Math.min(drawing.startX, drawing.endX)}%`,
                top: `${Math.min(drawing.startY, drawing.endY)}%`,
                width: `${Math.abs(drawing.endX - drawing.startX)}%`,
                height: `${Math.abs(drawing.endY - drawing.startY)}%`,
                border: `2px dashed ${selectedColor}`,
                backgroundColor: `${selectedColor}20`,
              }}
            />
          )}
        </div>
      </div>

      {/* Pending annotation label input */}
      {pendingAnnotation && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#1f2c34] border-t border-[#2a3942]">
          <div
            className="w-4 h-4 rounded flex-shrink-0"
            style={{ backgroundColor: pendingAnnotation.color }}
          />
          <input
            type="text"
            placeholder="Add label (optional)"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmAnnotation()}
            className="flex-1 bg-[#2a3942] text-[#e9edef] text-sm px-3 py-1.5 rounded-lg outline-none placeholder-[#8696a0]"
            autoFocus
          />
          <button
            onClick={confirmAnnotation}
            className="px-3 py-1.5 bg-[#00a884] text-white text-sm rounded-lg hover:bg-[#00c49a] transition-colors"
          >
            Save
          </button>
          <button
            onClick={cancelAnnotation}
            className="px-3 py-1.5 bg-[#2a3942] text-[#aebac1] text-sm rounded-lg hover:bg-[#3b4a54] transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Annotations list */}
      {annotations.length > 0 && (
        <div className="px-4 py-2 bg-[#1f2c34] border-t border-[#2a3942]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#8696a0] text-xs">Annotations:</span>
            {annotations.map((ann, i) => (
              <div
                key={ann.id}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
                style={{ backgroundColor: ann.color }}
              >
                <span>{ann.label || `#${i + 1}`}</span>
                <button
                  onClick={() =>
                    selectedImage &&
                    removeAnnotation(selectedImage.chatId, selectedImage.messageId, ann.id)
                  }
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
