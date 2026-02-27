"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSSE } from "@/hooks/useSSE";
import { ChatList } from "./ChatList";
import { ChatWindow } from "./ChatWindow";
import { ImageViewer } from "./ImageViewer";
import { SettingsPanel } from "./SettingsPanel";
import { useWhatsAppStore } from "@/lib/store";

const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 380;

// Load saved width from localStorage (called during render, not in effect)
function getInitialSidebarWidth(): number {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;
  const savedWidth = localStorage.getItem("whatsapp-sidebar-width");
  if (savedWidth) {
    const width = parseInt(savedWidth, 10);
    if (width >= MIN_SIDEBAR_WIDTH && width <= MAX_SIDEBAR_WIDTH) {
      return width;
    }
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

function AppHeader() {
  return (
    <div className="absolute top-2 right-2 z-20">
      <SettingsPanel />
    </div>
  );
}

export function WhatsAppApp() {
  // Initialize SSE connection for real-time messages
  useSSE();

  const { selectedImage } = useWhatsAppStore();
  
  // Sidebar width state with localStorage persistence
  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Handle resize start
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);
  
  // Handle resize move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;
    const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
    
    setSidebarWidth(clampedWidth);
  }, [isDragging]);
  
  // Handle resize end
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      // Save to localStorage
      localStorage.setItem("whatsapp-sidebar-width", sidebarWidth.toString());
    }
  }, [isDragging, sidebarWidth]);
  
  // Add/remove global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div 
      ref={containerRef}
      className="flex h-screen w-screen overflow-hidden bg-[#111b21] relative"
    >
      <AppHeader />

      {/* Sidebar - Chat List */}
      <div 
        className="flex-shrink-0 flex flex-col"
        style={{ width: sidebarWidth }}
      >
        <ChatList />
      </div>
      
      {/* Resize Handle */}
      <div
        className={`w-1 flex-shrink-0 bg-[#111b21] hover:bg-[#00a884] transition-colors cursor-col-resize relative z-10 ${
          isDragging ? "bg-[#00a884]" : ""
        }`}
        onMouseDown={handleMouseDown}
        title="Drag to resize"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-[#8696a0]/30 rounded-full" />
      </div>

      {/* Main - Chat Window */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatWindow />
      </div>

      {/* Image Viewer Overlay */}
      {selectedImage && <ImageViewer />}
    </div>
  );
}
