import type { GowaWebhookPayload, Message, Chat } from "@/types/whatsapp";

export function parseWebhookToMessage(payload: GowaWebhookPayload): Message {
  const chatId = payload.is_group
    ? payload.group_id || payload.from
    : payload.is_from_me
      ? payload.from
      : payload.from;

  const senderPhone = payload.is_group
    ? payload.sender || payload.from
    : payload.from;

  const senderName = payload.is_group
    ? payload.sender_name || payload.push_name || senderPhone
    : payload.push_name || payload.from;

  const message: Message = {
    id: payload.message_id,
    chatId,
    fromMe: payload.is_from_me,
    senderName,
    senderPhone,
    type: payload.type,
    timestamp: new Date(payload.timestamp),
    status: "delivered",
  };

  // Parse text
  if (payload.text) {
    message.text = payload.text;
  }

  // Parse media
  if (payload.image) {
    message.media = {
      url: payload.image.url,
      caption: payload.image.caption,
      mimeType: payload.image.mime_type,
      data: payload.image.data,
    };
  } else if (payload.video) {
    message.media = {
      url: payload.video.url,
      caption: payload.video.caption,
      mimeType: payload.video.mime_type,
      data: payload.video.data,
    };
  } else if (payload.audio) {
    message.media = {
      url: payload.audio.url,
      mimeType: payload.audio.mime_type,
      data: payload.audio.data,
    };
  } else if (payload.document) {
    message.media = {
      url: payload.document.url,
      caption: payload.document.caption,
      mimeType: payload.document.mime_type,
      fileName: payload.document.file_name,
      fileSize: payload.document.file_size,
      data: payload.document.data,
    };
  } else if (payload.sticker) {
    message.media = {
      url: payload.sticker.url,
      mimeType: payload.sticker.mime_type,
      data: payload.sticker.data,
    };
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
  if (payload.reaction) {
    message.reaction = payload.reaction;
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

  return {
    id: chatId,
    name: payload.is_group
      ? payload.group_name || chatId
      : payload.push_name || payload.from,
    phone: payload.is_group ? payload.group_id || payload.from : payload.from,
    isGroup: payload.is_group,
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
