"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, X, Save, ExternalLink, RefreshCw, LogOut, Smartphone, QrCode, CheckCircle, AlertCircle } from "lucide-react";
import { useWhatsAppStore } from "@/lib/store";

interface GowaDevice {
  id: string;
  display_name: string;
  jid: string;
  state: "connected" | "disconnected" | "connecting";
  created_at: string;
}

interface QrLoginResult {
  device_id: string;
  qr_duration: number;
  qr_link: string;
}

export function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { gowaBaseUrl, setGowaBaseUrl, gowaDeviceId, setGowaDeviceId } = useWhatsAppStore();
  const [urlInput, setUrlInput] = useState(gowaBaseUrl);
  const [deviceIdInput, setDeviceIdInput] = useState(gowaDeviceId);
  const [devices, setDevices] = useState<GowaDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [qrData, setQrData] = useState<QrLoginResult | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<string | null>(null);
  const [newDeviceId, setNewDeviceId] = useState("");
  const [creatingDevice, setCreatingDevice] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhook`
      : "/api/webhook";

  const proxyUrl = (path: string, deviceId?: string) => {
    const params = new URLSearchParams({
      gowaBaseUrl: urlInput.trim(),
      path,
    });
    if (deviceId) params.set("deviceId", deviceId);
    return `/api/gowa?${params.toString()}`;
  };

  const fetchDevices = useCallback(async () => {
    if (!urlInput.trim()) return;
    setLoadingDevices(true);
    try {
      const res = await fetch(proxyUrl("/devices"));
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        setDevices(data.results);
      } else if (Array.isArray(data)) {
        setDevices(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingDevices(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlInput]);

  const checkDeviceStatus = useCallback(async (deviceId: string) => {
    if (!urlInput.trim() || !deviceId) return;
    try {
      const res = await fetch(proxyUrl(`/devices/${deviceId}`, deviceId));
      const data = await res.json();
      if (data.results) {
        setDeviceStatus(data.results.state || "unknown");
      }
    } catch {
      setDeviceStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlInput]);

  useEffect(() => {
    if (isOpen) {
      fetchDevices();
      if (deviceIdInput) {
        checkDeviceStatus(deviceIdInput);
      }
    }
  }, [isOpen, fetchDevices, checkDeviceStatus, deviceIdInput]);

  // Poll QR code status
  useEffect(() => {
    if (!qrData) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(proxyUrl(`/devices/${deviceIdInput}`, deviceIdInput));
        const data = await res.json();
        if (data.results?.state === "connected") {
          setQrData(null);
          setDeviceStatus("connected");
          clearInterval(interval);
          fetchDevices();
        }
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrData, deviceIdInput]);

  const handleGetQR = async () => {
    setQrLoading(true);
    setQrError(null);
    setQrData(null);
    try {
      const res = await fetch(proxyUrl(`/app/login?device_id=${deviceIdInput}`));
      const data = await res.json();
      if (data.results?.qr_link) {
        setQrData(data.results);
      } else if (data.code === "DEVICE_NOT_FOUND") {
        setQrError("Device not found. Create a device first.");
      } else {
        setQrError(data.message || "Failed to get QR code");
      }
    } catch (err) {
      setQrError("Failed to connect to GOWA. Check the URL.");
    } finally {
      setQrLoading(false);
    }
  };

  const handleCreateDevice = async () => {
    if (!newDeviceId.trim()) return;
    setCreatingDevice(true);
    try {
      const res = await fetch(
        `/api/gowa?gowaBaseUrl=${encodeURIComponent(urlInput.trim())}&path=/devices`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device_id: newDeviceId.trim() }),
        }
      );
      const data = await res.json();
      if (data.code === "SUCCESS") {
        setDeviceIdInput(newDeviceId.trim());
        setNewDeviceId("");
        await fetchDevices();
      } else {
        alert(data.message || "Failed to create device");
      }
    } catch {
      alert("Failed to create device");
    } finally {
      setCreatingDevice(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm("Are you sure you want to logout from WhatsApp?")) return;
    try {
      await fetch(proxyUrl(`/app/logout?device_id=${deviceIdInput}`));
      setDeviceStatus("disconnected");
      setQrData(null);
      fetchDevices();
    } catch {
      alert("Failed to logout");
    }
  };

  const handleSave = () => {
    setGowaBaseUrl(urlInput.trim());
    setGowaDeviceId(deviceIdInput.trim());
    setIsOpen(false);
  };

  const getStatusColor = (status: string | null) => {
    if (status === "connected") return "text-[#00a884]";
    if (status === "connecting") return "text-yellow-400";
    return "text-[#8696a0]";
  };

  const getStatusIcon = (status: string | null) => {
    if (status === "connected") return <CheckCircle className="w-4 h-4 text-[#00a884]" />;
    if (status === "error") return <AlertCircle className="w-4 h-4 text-red-400" />;
    return <Smartphone className="w-4 h-4 text-[#8696a0]" />;
  };

  return (
    <>
      <button
        onClick={() => {
          setUrlInput(gowaBaseUrl);
          setDeviceIdInput(gowaDeviceId);
          setIsOpen(true);
        }}
        className="p-2 rounded-full hover:bg-[#2a3942] transition-colors"
        title="Settings"
      >
        <Settings className="w-5 h-5 text-[#aebac1]" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#233138] rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3942] sticky top-0 bg-[#233138]">
              <h2 className="text-[#e9edef] font-semibold">GOWA Settings</h2>
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
                  placeholder="http://localhost:3001"
                  className="w-full bg-[#2a3942] text-[#e9edef] text-sm px-3 py-2.5 rounded-lg outline-none placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884]"
                />
                <p className="text-xs text-[#8696a0] mt-1">
                  The base URL of your GOWA instance (default port: 3001)
                </p>
              </div>

              {/* Device ID */}
              <div>
                <label className="block text-sm font-medium text-[#e9edef] mb-2">
                  Device ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={deviceIdInput}
                    onChange={(e) => setDeviceIdInput(e.target.value)}
                    placeholder="default"
                    className="flex-1 bg-[#2a3942] text-[#e9edef] text-sm px-3 py-2.5 rounded-lg outline-none placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884]"
                  />
                  <button
                    onClick={() => checkDeviceStatus(deviceIdInput)}
                    className="px-3 py-2 bg-[#2a3942] text-[#aebac1] rounded-lg hover:bg-[#3b4a54] transition-colors"
                    title="Check status"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                {deviceStatus && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {getStatusIcon(deviceStatus)}
                    <span className={`text-xs ${getStatusColor(deviceStatus)}`}>
                      Status: {deviceStatus}
                    </span>
                  </div>
                )}
              </div>

              {/* Devices list */}
              {devices.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-[#e9edef]">
                      Available Devices
                    </label>
                    <button
                      onClick={fetchDevices}
                      disabled={loadingDevices}
                      className="text-xs text-[#8696a0] hover:text-[#e9edef] flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${loadingDevices ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                  </div>
                  <div className="space-y-1">
                    {devices.map((device) => (
                      <button
                        key={device.id}
                        onClick={() => setDeviceIdInput(device.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          deviceIdInput === device.id
                            ? "bg-[#00a884]/20 border border-[#00a884]/40"
                            : "bg-[#2a3942] hover:bg-[#3b4a54]"
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            device.state === "connected"
                              ? "bg-[#00a884]"
                              : "bg-[#8696a0]"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#e9edef] truncate">
                            {device.display_name || device.id}
                          </p>
                          <p className="text-xs text-[#8696a0] truncate">
                            {device.jid || device.state}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Create new device */}
              <div>
                <label className="block text-sm font-medium text-[#e9edef] mb-2">
                  Create New Device
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDeviceId}
                    onChange={(e) => setNewDeviceId(e.target.value)}
                    placeholder="device-id (e.g. default)"
                    className="flex-1 bg-[#2a3942] text-[#e9edef] text-sm px-3 py-2.5 rounded-lg outline-none placeholder-[#8696a0] focus:ring-2 focus:ring-[#00a884]"
                    onKeyDown={(e) => e.key === "Enter" && handleCreateDevice()}
                  />
                  <button
                    onClick={handleCreateDevice}
                    disabled={creatingDevice || !newDeviceId.trim()}
                    className="px-3 py-2 bg-[#00a884] text-white text-sm rounded-lg hover:bg-[#00c49a] disabled:opacity-50 transition-colors"
                  >
                    {creatingDevice ? "..." : "Create"}
                  </button>
                </div>
              </div>

              {/* QR Code Login */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-[#e9edef]">
                    WhatsApp Login (QR Code)
                  </label>
                  {deviceStatus === "connected" && (
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                    >
                      <LogOut className="w-3 h-3" />
                      Logout
                    </button>
                  )}
                </div>

                {deviceStatus === "connected" ? (
                  <div className="flex items-center gap-2 bg-[#00a884]/10 border border-[#00a884]/30 rounded-lg px-3 py-2.5">
                    <CheckCircle className="w-5 h-5 text-[#00a884]" />
                    <span className="text-sm text-[#00a884]">WhatsApp connected!</span>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleGetQR}
                      disabled={qrLoading || !deviceIdInput}
                      className="flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-[#2a3942] text-[#e9edef] text-sm rounded-lg hover:bg-[#3b4a54] disabled:opacity-50 transition-colors"
                    >
                      {qrLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <QrCode className="w-4 h-4" />
                      )}
                      {qrLoading ? "Getting QR Code..." : "Get QR Code to Login"}
                    </button>

                    {qrError && (
                      <p className="text-xs text-red-400 mt-2">{qrError}</p>
                    )}

                    {qrData && (
                      <div className="mt-3 text-center">
                        <div className="bg-white p-3 rounded-xl inline-block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={(() => {
                              try {
                                const qrUrl = new URL(qrData.qr_link);
                                return `/api/gowa?gowaBaseUrl=${encodeURIComponent(urlInput.trim())}&path=${encodeURIComponent(qrUrl.pathname)}`;
                              } catch {
                                return qrData.qr_link;
                              }
                            })()}
                            alt="WhatsApp QR Code"
                            className="w-48 h-48 object-contain"
                            onError={(e) => {
                              // Try direct URL as fallback
                              (e.target as HTMLImageElement).src = qrData.qr_link;
                            }}
                          />
                        </div>
                        <p className="text-xs text-[#8696a0] mt-2">
                          Scan with WhatsApp on your phone
                        </p>
                        <p className="text-xs text-[#8696a0]">
                          QR expires in {qrData.qr_duration}s • Auto-refreshing...
                        </p>
                        <div className="mt-2">
                          <a
                            href={qrData.qr_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#53bdeb] hover:underline flex items-center gap-1 justify-center"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open QR code in new tab
                          </a>
                        </div>
                      </div>
                    )}
                  </>
                )}
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
                  Run GOWA with: <code className="text-[#00a884]">--webhook &quot;{webhookUrl}&quot;</code>
                </p>
              </div>

              {/* GOWA setup instructions */}
              <div className="bg-[#1f2c34] rounded-lg p-4">
                <h3 className="text-sm font-medium text-[#e9edef] mb-2">
                  Quick Setup
                </h3>
                <ol className="text-xs text-[#8696a0] space-y-1.5 list-decimal list-inside">
                  <li>
                    Download{" "}
                    <a
                      href="https://github.com/aldinokemal/go-whatsapp-web-multidevice/releases/latest"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#53bdeb] hover:underline inline-flex items-center gap-0.5"
                    >
                      GOWA binary <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>
                    Run:{" "}
                    <code className="text-[#00a884]">
                      ./whatsapp rest --port 3001 --webhook &quot;{webhookUrl}&quot;
                    </code>
                  </li>
                  <li>Set GOWA URL to <code className="text-[#00a884]">http://localhost:3001</code></li>
                  <li>Create a device (e.g. &quot;default&quot;) and click &quot;Get QR Code&quot;</li>
                  <li>Scan QR code with WhatsApp on your phone</li>
                </ol>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#2a3942] sticky bottom-0 bg-[#233138]">
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
