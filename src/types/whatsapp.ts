// GOWA Webhook payload types
export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "location"
  | "contact"
  | "reaction"
  | "revoked";

export interface GowaWebhookPayload {
  from: string;
  message_id: string;
  push_name: string;
  is_from_me: boolean;
  type: MessageType;
  text?: string;
  image?: GowaMedia;
  video?: GowaMedia;
  audio?: GowaMedia;
  document?: GowaMedia;
  sticker?: GowaMedia;
  location?: GowaLocation;
  contact?: GowaContact;
  reaction?: GowaReaction;
  reply_message?: GowaReplyMessage;
  timestamp: string;
  is_group: boolean;
  group_id?: string;
  group_name?: string;
  sender?: string;
  sender_name?: string;
}

export interface GowaMedia {
  url?: string;
  caption?: string;
  mime_type?: string;
  file_name?: string;
  file_size?: number;
  data?: string; // base64
}

export interface GowaLocation {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface GowaContact {
  name: string;
  phone: string;
}

export interface GowaReaction {
  message_id: string;
  emoji: string;
}

export interface GowaReplyMessage {
  message_id: string;
  text?: string;
  type: MessageType;
}

// Internal app types
export interface Message {
  id: string;
  chatId: string;
  fromMe: boolean;
  senderName: string;
  senderPhone: string;
  type: MessageType;
  text?: string;
  media?: MediaContent;
  location?: GowaLocation;
  contact?: GowaContact;
  reaction?: GowaReaction;
  replyTo?: ReplyInfo;
  timestamp: Date;
  status: "sent" | "delivered" | "read" | "failed";
  isDeleted?: boolean;
  annotations?: ImageAnnotation[];
}

export interface MediaContent {
  url?: string;
  caption?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  data?: string; // base64
  localUrl?: string; // blob URL for preview
}

export interface ReplyInfo {
  messageId: string;
  text?: string;
  type: MessageType;
  senderName?: string;
}

export interface ImageAnnotation {
  id: string;
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
  color: string;
  label?: string;
  createdAt: Date;
}

export interface Chat {
  id: string;
  name: string;
  phone: string;
  isGroup: boolean;
  groupId?: string;
  lastMessage?: Message;
  unreadCount: number;
  avatar?: string;
  isPinned?: boolean;
  isMuted?: boolean;
  updatedAt: Date;
}

// GOWA API types for sending messages
export interface SendTextRequest {
  phone: string;
  message: string;
  reply_message_id?: string;
}

export interface SendImageRequest {
  phone: string;
  caption?: string;
  image: File | string; // File object or base64
  reply_message_id?: string;
}

export interface SendDocumentRequest {
  phone: string;
  caption?: string;
  document: File | string;
  reply_message_id?: string;
}

export interface SendVideoRequest {
  phone: string;
  caption?: string;
  video: File | string;
  reply_message_id?: string;
}

export interface SendAudioRequest {
  phone: string;
  audio: File | string;
  reply_message_id?: string;
}

export interface GowaApiResponse {
  code: string;
  message: string;
  results?: unknown;
}

// Config
export interface GowaConfig {
  baseUrl: string;
  webhookSecret?: string;
}
