"use client";

import { useSSE } from "@/hooks/useSSE";
import { ChatList } from "./ChatList";
import { ChatWindow } from "./ChatWindow";
import { ImageViewer } from "./ImageViewer";
import { SettingsPanel } from "./SettingsPanel";
import { useWhatsAppStore } from "@/lib/store";

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#111b21] relative">
      <AppHeader />

      {/* Sidebar - Chat List */}
      <div className="w-[380px] flex-shrink-0 flex flex-col">
        <ChatList />
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
