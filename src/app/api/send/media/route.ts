import { NextRequest, NextResponse } from "next/server";

// POST /api/send/media - Proxy file uploads to GOWA API
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const gowaBaseUrl = formData.get("gowaBaseUrl") as string;
    const endpoint = formData.get("endpoint") as string;
    const deviceId = formData.get("deviceId") as string | null;

    if (!gowaBaseUrl || !endpoint) {
      return NextResponse.json(
        { error: "gowaBaseUrl and endpoint are required" },
        { status: 400 }
      );
    }

    // Remove our internal fields
    formData.delete("gowaBaseUrl");
    formData.delete("endpoint");
    formData.delete("deviceId");

    const normalizedBase = gowaBaseUrl.replace(/\/$/, "");
    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const targetUrl = `${normalizedBase}${normalizedEndpoint}`;

    const headers: Record<string, string> = {};
    if (deviceId) {
      headers["X-Device-Id"] = deviceId;
    }

    const doPost = (url: string, body: FormData) =>
      fetch(url, {
        method: "POST",
        headers,
        body,
      });

    let response = await doPost(targetUrl, formData);

    // Compatibility fallback: some GOWA versions expose media endpoints under /api/send/*
    if (response.status === 404 && normalizedEndpoint.startsWith("/send/")) {
      const retryBody = new FormData();
      formData.forEach((value, key) => retryBody.append(key, value));
      const retryUrl = `${normalizedBase}/api${normalizedEndpoint}`;
      response = await doPost(retryUrl, retryBody);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    const text = await response.text();
    return NextResponse.json(
      {
        code: response.ok ? "SUCCESS" : "ERROR",
        message: text || (response.ok ? "Media sent" : "Failed to send media"),
      },
      { status: response.status }
    );
  } catch (error) {
    console.error("Media send API error:", error);
    return NextResponse.json(
      { error: "Failed to send media" },
      { status: 500 }
    );
  }
}
