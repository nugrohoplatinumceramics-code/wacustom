import { NextRequest, NextResponse } from "next/server";

// POST /api/send/media - Proxy file uploads to GOWA API
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const gowaBaseUrl = formData.get("gowaBaseUrl") as string;
    const endpoint = formData.get("endpoint") as string;

    if (!gowaBaseUrl || !endpoint) {
      return NextResponse.json(
        { error: "gowaBaseUrl and endpoint are required" },
        { status: 400 }
      );
    }

    // Remove our internal fields
    formData.delete("gowaBaseUrl");
    formData.delete("endpoint");

    const targetUrl = `${gowaBaseUrl.replace(/\/$/, "")}${endpoint}`;

    const response = await fetch(targetUrl, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Media send API error:", error);
    return NextResponse.json(
      { error: "Failed to send media" },
      { status: 500 }
    );
  }
}
