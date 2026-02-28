import type { GowaWebhookPayload, Message, Chat } from "@/types/whatsapp";

interface ParseWebhookOptions {
  event?: string;
}

function toMediaContent(media?: GowaWebhookPayload["image"]) {
  if (!media) return undefined;
  if (typeof media === "string") return { url: media };
  return {
    url: media.url || media.path,
    caption: media.caption,
    mimeType: media.mime_type,
    fileName: media.file_name || media.filename,
    fileSize: media.file_size,
    data: media.data,
  };
}

function inferIsGroup(payload: GowaWebhookPayload): boolean {
  if (typeof payload.is_group === "boolean") return payload.is_group;
  if (payload.group_id) return true;
  return (payload.chat_id || payload.from || "").endsWith("@g.us");
}

function inferMessageType(payload: GowaWebhookPayload, event?: string): Message["type"] {
  if (event === "message.reaction") return "reaction";
  if (event === "message.revoked") return "revoked";
  if (payload.type) return payload.type;
  if (payload.reaction || payload.reacted_message_id) return "reaction";
  if (payload.revoked_message_id) return "revoked";
  if (payload.image) return "image";
  if (payload.video) return "video";
  if (payload.audio) return "audio";
  if (payload.document) return "document";
  if (payload.sticker) return "sticker";
  if (payload.location) return "location";
  if (payload.contact) return "contact";
  return "text";
}

export function parseWebhookToMessage(
  payload: GowaWebhookPayload,
  options: ParseWebhookOptions = {}
): Message {
  const isGroup = inferIsGroup(payload);
  const chatId = payload.chat_id || (isGroup ? payload.group_id || payload.from : payload.from) || "unknown@chat";
  const senderPhone = isGroup ? payload.sender || payload.from || chatId : payload.from || chatId;
  const senderName = isGroup
    ? payload.sender_name || payload.from_name || payload.push_name || senderPhone
    : payload.from_name || payload.push_name || payload.from || senderPhone;
  const messageType = inferMessageType(payload, options.event);
  const messageId = payload.message_id || payload.id || `${chatId}-${payload.timestamp || Date.now()}`;
  const rawReaction = payload.reaction;

  const message: Message = {
    id: messageId,
    chatId,
    fromMe: Boolean(payload.is_from_me),
    senderName,
    senderPhone,
    type: messageType,
    timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
    status: "delivered",
  };

  // Parse text
  if (payload.text || payload.body) {
    message.text = payload.text || payload.body;
  }

  // Parse media
  if (payload.image) {
    message.media = toMediaContent(payload.image);
  } else if (payload.video) {
    message.media = toMediaContent(payload.video);
  } else if (payload.audio) {
    message.media = toMediaContent(payload.audio);
  } else if (payload.document) {
    message.media = toMediaContent(payload.document);
  } else if (payload.sticker) {
    message.media = toMediaContent(payload.sticker);
  }

  // Parse location
  if (payload.location) {
    message.location = payload.location;
  }

  // Parse contact
  if (payload.contact) {
    message.contact = payload.contact;
  }

  // Parse reaction
  if (rawReaction) {
    if (typeof rawReaction === "string") {
      message.reaction = {
        message_id: payload.reacted_message_id || "",
        emoji: rawReaction,
      };
    } else {
      message.reaction = rawReaction;
    }
  }

  // Parse reply
  if (payload.reply_message) {
    message.replyTo = {
      messageId: payload.reply_message.message_id,
      text: payload.reply_message.text,
      type: payload.reply_message.type,
    };
  }

  return message;
}

export function parseWebhookToChat(
  payload: GowaWebhookPayload,
  message: Message
): Chat {
  const chatId = message.chatId;
  const isGroup = inferIsGroup(payload);

  return {
    id: chatId,
    name: isGroup
      ? payload.group_name || chatId
      : payload.from_name || payload.push_name || payload.from || chatId,
    phone: isGroup ? payload.group_id || payload.chat_id || payload.from || chatId : payload.chat_id || payload.from || chatId,
    isGroup,
    groupId: payload.group_id,
    lastMessage: message,
    unreadCount: payload.is_from_me ? 0 : 1,
    updatedAt: message.timestamp,
  };
}

export function formatPhoneNumber(phone: string): string {
  // Remove @s.whatsapp.net or @g.us suffix
  return phone.replace(/@.*$/, "");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
