import { NextRequest, NextResponse } from "next/server";

// GET /api/gowa?gowaBaseUrl=...&path=...&deviceId=...
// POST /api/gowa?gowaBaseUrl=...&path=...&deviceId=...
// Proxy requests to GOWA API

async function proxyRequest(request: NextRequest, method: string) {
  try {
    const { searchParams } = new URL(request.url);
    const gowaBaseUrl = searchParams.get("gowaBaseUrl");
    const path = searchParams.get("path");
    const deviceId = searchParams.get("deviceId");

    if (!gowaBaseUrl || !path) {
      return NextResponse.json(
        { error: "gowaBaseUrl and path are required" },
        { status: 400 }
      );
    }

    // Build target URL with query params
    const targetUrlObj = new URL(path, gowaBaseUrl.replace(/\/$/, ""));
    if (deviceId) {
      targetUrlObj.searchParams.set("device_id", deviceId);
    }
    const targetUrl = targetUrlObj.toString();

    const headers: Record<string, string> = {};
    if (deviceId) {
      headers["X-Device-Id"] = deviceId;
    }

    let body: BodyInit | undefined;
    if (method === "POST") {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await request.json();
        body = JSON.stringify(json);
        headers["Content-Type"] = "application/json";
      } else if (contentType.includes("multipart/form-data")) {
        body = await request.formData();
      } else {
        body = await request.text();
      }
    }

    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
    });

    // Handle image responses (QR code)
    const responseContentType = response.headers.get("content-type") || "";
    if (responseContentType.includes("image/")) {
      const buffer = await response.arrayBuffer();
      return new NextResponse(buffer, {
        status: response.status,
        headers: {
          "Content-Type": responseContentType,
          "Cache-Control": "no-cache",
        },
      });
    }

    if (responseContentType.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type": responseContentType || "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("GOWA proxy error:", error);
    return NextResponse.json(
      { error: "Failed to proxy request to GOWA" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, "GET");
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, "POST");
}

export async function DELETE(request: NextRequest) {
  return proxyRequest(request, "DELETE");
}
