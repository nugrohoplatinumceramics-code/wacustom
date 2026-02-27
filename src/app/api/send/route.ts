import { NextRequest, NextResponse } from "next/server";

// POST /api/send - Proxy to GOWA API for sending messages
export async function POST(request: NextRequest) {
  try {
    const { gowaBaseUrl, endpoint, deviceId, ...body } = await request.json();

    if (!gowaBaseUrl) {
      return NextResponse.json(
        { error: "GOWA base URL is required" },
        { status: 400 }
      );
    }

    const targetUrl = `${gowaBaseUrl.replace(/\/$/, "")}${endpoint}`;

    const formData = new FormData();
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    }

    const headers: Record<string, string> = {};
    if (deviceId) {
      headers["X-Device-Id"] = deviceId;
    }

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: formData,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Send API error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
