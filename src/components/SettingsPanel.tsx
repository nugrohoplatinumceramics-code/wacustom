"use client";

import { useState } from "react";
import { Settings, X, Save, ExternalLink } from "lucide-react";
import { useWhatsAppStore } from "@/lib/store";

export function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { gowaBaseUrl, setGowaBaseUrl } = useWhatsAppStore();
  const [urlInput, setUrlInput] = useState(gowaBaseUrl);

  const handleSave = () => {
    setGowaBaseUrl(urlInput.trim());
    setIsOpen(false);
  };

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhook`
      : "/api/webhook";

  return (
    <>
      <button
        onClick={() => {
          setUrlInput(gowaBaseUrl);
          setIsOpen(true);
        }}
        className="p-2 rounded-full hover:bg-[#2a3942] transition-colors"
        title="Settings"
      >
        <Settings className="w-5 h-5 text-[#aebac1]" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#233138] rounded-xl shadow-2xl w-full max-w-md mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3942]">
              <h2 className="text-[#e9edef] font-semibold">Settings</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-[#2a3942]"
              >
                <X className="w-5 h-5 text-[#8696a0]" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-5">
              {/* GOWA URL */}
              <div>
                <label className="block text-sm font-medium text-[#e9edef] mb-2">
                  GOWA Base URL
                </label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="http://localhost:3000"
                  className="w-full bg-[#2a3942] text-[#e9edef] text-sm px-3 py-2.5 rounded-lg outline-none placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884]"
                />
                <p className="text-xs text-[#8696a0] mt-1">
                  The base URL of your GOWA (go-whatsapp-web-multidevice) instance
                </p>
              </div>

              {/* Webhook URL */}
              <div>
                <label className="block text-sm font-medium text-[#e9edef] mb-2">
                  Webhook URL (configure in GOWA)
                </label>
                <div className="flex items-center gap-2 bg-[#2a3942] rounded-lg px-3 py-2.5">
                  <code className="flex-1 text-sm text-[#00a884] break-all">
                    {webhookUrl}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(webhookUrl)}
                    className="text-xs text-[#8696a0] hover:text-[#e9edef] flex-shrink-0"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-[#8696a0] mt-1">
                  Set this URL as the webhook in your GOWA configuration to receive messages
                </p>
              </div>

              {/* GOWA setup instructions */}
              <div className="bg-[#1f2c34] rounded-lg p-4">
                <h3 className="text-sm font-medium text-[#e9edef] mb-2">
                  GOWA Setup Instructions
                </h3>
                <ol className="text-xs text-[#8696a0] space-y-1.5 list-decimal list-inside">
                  <li>
                    Install and run{" "}
                    <a
                      href="https://github.com/aldinokemal/go-whatsapp-web-multidevice"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#53bdeb] hover:underline inline-flex items-center gap-0.5"
                    >
                      GOWA <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Set the GOWA base URL above</li>
                  <li>
                    In GOWA settings, set webhook URL to:{" "}
                    <code className="text-[#00a884]">{webhookUrl}</code>
                  </li>
                  <li>Scan QR code in GOWA to connect WhatsApp</li>
                  <li>Messages will appear here in real-time</li>
                </ol>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#2a3942]">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm text-[#8696a0] hover:text-[#e9edef] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-[#00a884] text-white text-sm rounded-lg hover:bg-[#00c49a] transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
