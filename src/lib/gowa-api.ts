import type {
  GowaApiResponse,
  SendTextRequest,
  SendImageRequest,
  SendDocumentRequest,
  SendVideoRequest,
  SendAudioRequest,
} from "@/types/whatsapp";

export class GowaApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<GowaApiResponse & { results?: T }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`GOWA API error ${res.status}: ${error}`);
    }

    return res.json();
  }

  async sendText(data: SendTextRequest): Promise<GowaApiResponse> {
    const formData = new FormData();
    formData.append("phone", data.phone);
    formData.append("message", data.message);
    if (data.reply_message_id) {
      formData.append("reply_message_id", data.reply_message_id);
    }

    return this.request("/api/send/message", {
      method: "POST",
      body: formData,
    });
  }

  async sendImage(data: SendImageRequest): Promise<GowaApiResponse> {
    const formData = new FormData();
    formData.append("phone", data.phone);
    if (data.caption) formData.append("caption", data.caption);
    if (data.reply_message_id) {
      formData.append("reply_message_id", data.reply_message_id);
    }

    if (data.image instanceof File) {
      formData.append("image", data.image);
    } else {
      formData.append("image_url", data.image);
    }

    return this.request("/api/send/image", {
      method: "POST",
      body: formData,
    });
  }

  async sendDocument(data: SendDocumentRequest): Promise<GowaApiResponse> {
    const formData = new FormData();
    formData.append("phone", data.phone);
    if (data.caption) formData.append("caption", data.caption);
    if (data.reply_message_id) {
      formData.append("reply_message_id", data.reply_message_id);
    }

    if (data.document instanceof File) {
      formData.append("document", data.document);
    } else {
      formData.append("document_url", data.document);
    }

    return this.request("/api/send/document", {
      method: "POST",
      body: formData,
    });
  }

  async sendVideo(data: SendVideoRequest): Promise<GowaApiResponse> {
    const formData = new FormData();
    formData.append("phone", data.phone);
    if (data.caption) formData.append("caption", data.caption);
    if (data.reply_message_id) {
      formData.append("reply_message_id", data.reply_message_id);
    }

    if (data.video instanceof File) {
      formData.append("video", data.video);
    } else {
      formData.append("video_url", data.video);
    }

    return this.request("/api/send/video", {
      method: "POST",
      body: formData,
    });
  }

  async sendAudio(data: SendAudioRequest): Promise<GowaApiResponse> {
    const formData = new FormData();
    formData.append("phone", data.phone);
    if (data.reply_message_id) {
      formData.append("reply_message_id", data.reply_message_id);
    }

    if (data.audio instanceof File) {
      formData.append("audio", data.audio);
    } else {
      formData.append("audio_url", data.audio);
    }

    return this.request("/api/send/audio", {
      method: "POST",
      body: formData,
    });
  }

  async getDeviceInfo(): Promise<GowaApiResponse> {
    return this.request("/api/app/devices");
  }

  async logout(): Promise<GowaApiResponse> {
    return this.request("/api/app/logout", { method: "POST" });
  }
}

let clientInstance: GowaApiClient | null = null;

export function getGowaClient(baseUrl: string): GowaApiClient {
  if (!clientInstance || clientInstance["baseUrl"] !== baseUrl) {
    clientInstance = new GowaApiClient(baseUrl);
  }
  return clientInstance;
}
