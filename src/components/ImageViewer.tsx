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

interface DrawingFreehand {
  points: { x: number; y: number }[];
}

export function ImageViewer() {
  const {
    selectedImage,
    setSelectedImage,
    addAnnotation,
    removeAnnotation,
    clearAnnotations,
    messages,
  } =
    useWhatsAppStore();

  const [zoom, setZoom] = useState(1);
  const [isUiHidden, setIsUiHidden] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotationMode, setAnnotationMode] = useState<"rect" | "freehand">("rect");
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[0]);
  const [drawingRect, setDrawingRect] = useState<DrawingRect | null>(null);
  const [drawingFreehand, setDrawingFreehand] = useState<DrawingFreehand | null>(null);
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
    setIsUiHidden(false);
    setIsAnnotating(false);
    setDrawingRect(null);
    setDrawingFreehand(null);
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
    if (annotationMode === "rect") {
      setDrawingRect({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
      return;
    }
    setDrawingFreehand({ points: [pos] });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isAnnotating) return;
    const pos = getRelativePosition(e);
    if (annotationMode === "rect") {
      if (!drawingRect) return;
      setDrawingRect((prev) => (prev ? { ...prev, endX: pos.x, endY: pos.y } : null));
      return;
    }
    if (!drawingFreehand) return;
    setDrawingFreehand((prev) =>
      prev ? { ...prev, points: [...prev.points, pos] } : null
    );
  };

  const handleMouseUp = () => {
    if (!isAnnotating) return;

    if (annotationMode === "rect") {
      if (!drawingRect) return;
      const minX = Math.min(drawingRect.startX, drawingRect.endX);
      const minY = Math.min(drawingRect.startY, drawingRect.endY);
      const width = Math.abs(drawingRect.endX - drawingRect.startX);
      const height = Math.abs(drawingRect.endY - drawingRect.startY);

      if (width > 1 && height > 1) {
        setPendingAnnotation({
          kind: "rect",
          x: minX,
          y: minY,
          width,
          height,
          color: selectedColor,
        });
      }
      setDrawingRect(null);
      return;
    }

    if (!drawingFreehand || drawingFreehand.points.length < 2) {
      setDrawingFreehand(null);
      return;
    }

    const xs = drawingFreehand.points.map((p) => p.x);
    const ys = drawingFreehand.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = Math.max(0.5, maxX - minX);
    const height = Math.max(0.5, maxY - minY);

    setPendingAnnotation({
      kind: "freehand",
      x: minX,
      y: minY,
      width,
      height,
      points: drawingFreehand.points,
      strokeWidth: 0.8,
      color: selectedColor,
    });
    setDrawingFreehand(null);
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
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[1px] flex items-center justify-center p-4"
      onMouseDown={handleClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] bg-[#111b21] border border-[#2a3942] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        {!isUiHidden && (
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

            {isAnnotating && (
              <div className="flex items-center gap-1 bg-[#2a3942] rounded-lg p-1">
                <button
                  onClick={() => setAnnotationMode("rect")}
                  className={`px-2 py-1 text-xs rounded ${
                    annotationMode === "rect" ? "bg-[#00a884] text-white" : "text-[#aebac1]"
                  }`}
                >
                  Rect
                </button>
                <button
                  onClick={() => setAnnotationMode("freehand")}
                  className={`px-2 py-1 text-xs rounded ${
                    annotationMode === "freehand" ? "bg-[#00a884] text-white" : "text-[#aebac1]"
                  }`}
                >
                  Freehand
                </button>
              </div>
            )}

            {annotations.length > 0 && selectedImage && (
              <button
                onClick={() =>
                  clearAnnotations(selectedImage.chatId, selectedImage.messageId)
                }
                className="px-3 py-1.5 rounded-lg text-sm bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                title="Clear all annotations"
              >
                Clear
              </button>
            )}

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
        )}

        {/* Annotation color picker */}
        {!isUiHidden && isAnnotating && (
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
              {annotationMode === "rect"
                ? "Draw a rectangle on the image to annotate"
                : "Draw freehand on the image to annotate"}
            </span>
          </div>
        )}

        {/* Image area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
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
              onClick={() => {
                if (!isAnnotating) setIsUiHidden((prev) => !prev);
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              draggable={false}
            />

            {/* Existing annotations */}
            {annotations.map((ann) => (
              <div key={ann.id}>
                {ann.kind === "freehand" && ann.points && ann.points.length > 1 ? (
                  <>
                    <svg
                      className="absolute inset-0 pointer-events-none w-full h-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <polyline
                        points={ann.points.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke={ann.color}
                        strokeWidth={ann.strokeWidth || 0.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <button
                      className="absolute w-5 h-5 rounded-full bg-red-500 text-white opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                      style={{ left: `${ann.x + ann.width}%`, top: `${ann.y}%` }}
                      onClick={() =>
                        selectedImage &&
                        removeAnnotation(selectedImage.chatId, selectedImage.messageId, ann.id)
                      }
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {ann.label && (
                      <span
                        className="absolute text-xs px-1 py-0.5 rounded text-white whitespace-nowrap"
                        style={{ left: `${ann.x}%`, top: `${Math.max(0, ann.y - 5)}%`, backgroundColor: ann.color }}
                      >
                        {ann.label}
                      </span>
                    )}
                  </>
                ) : (
                  <div
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
                )}
              </div>
            ))}

            {/* Drawing preview */}
            {drawingRect && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${Math.min(drawingRect.startX, drawingRect.endX)}%`,
                  top: `${Math.min(drawingRect.startY, drawingRect.endY)}%`,
                  width: `${Math.abs(drawingRect.endX - drawingRect.startX)}%`,
                  height: `${Math.abs(drawingRect.endY - drawingRect.startY)}%`,
                  border: `2px dashed ${selectedColor}`,
                  backgroundColor: `${selectedColor}20`,
                }}
              />
            )}

            {drawingFreehand && drawingFreehand.points.length > 1 && (
              <svg
                className="absolute inset-0 pointer-events-none w-full h-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <polyline
                  points={drawingFreehand.points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={selectedColor}
                  strokeWidth={0.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>

        {/* Pending annotation label input */}
        {!isUiHidden && pendingAnnotation && (
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
        {!isUiHidden && annotations.length > 0 && (
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
    </div>
  );
}
