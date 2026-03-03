# Active Context: WhatsApp Web Clone (GOWA)

## Current State

**App Status**: ✅ WhatsApp Web clone fully built and deployed

A full-featured WhatsApp Web clone built on Next.js 16 that integrates with [GOWA (go-whatsapp-web-multidevice)](https://github.com/aldinokemal/go-whatsapp-web-multidevice) via webhook for real-time message reception and API for sending messages.

## Recently Completed

- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features
- [x] WhatsApp Web clone UI with GOWA integration
- [x] Real-time message reception via SSE from GOWA webhook
- [x] Chat list sidebar with search, pin, mute, unread count
- [x] Message bubbles for all message types (text, image, video, audio, document, location, contact, sticker)
- [x] Reply to messages with preview
- [x] Send text and media via GOWA API
- [x] Image viewer with zoom and annotation/marking feature
- [x] Settings panel for GOWA configuration
- [x] Zustand store with localStorage persistence
- [x] Resizable sidebar with draggable divider (280px - 600px range)
- [x] Download attachments - images, videos, audio files can be downloaded from chat
- [x] Backup & Restore chat - export/import all chats and messages with media to JSON file
- [x] Message context menu - hover over any message to see reply, forward, and delete options
- [x] Delete messages - messages can be deleted locally (marked as deleted)
- [x] Forward messages - forward any message to other chats with search/filter dialog

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Home page (renders WhatsAppApp) | ✅ Ready |
| `src/app/layout.tsx` | Root layout | ✅ Ready |
| `src/app/globals.css` | Global styles + scrollbar | ✅ Ready |
| `src/app/api/webhook/route.ts` | GOWA webhook receiver + SSE endpoint | ✅ Ready |
| `src/app/api/send/route.ts` | Proxy for text message sending | ✅ Ready |
| `src/app/api/send/media/route.ts` | Proxy for media file sending | ✅ Ready |
| `src/components/WhatsAppApp.tsx` | Root app component | ✅ Ready |
| `src/components/ChatList.tsx` | Sidebar with chat list | ✅ Ready |
| `src/components/ChatWindow.tsx` | Main chat area with messages | ✅ Ready |
| `src/components/MessageInput.tsx` | Message input with attachments | ✅ Ready |
| `src/components/ImageViewer.tsx` | Full-screen image viewer with annotations | ✅ Ready |
| `src/components/SettingsPanel.tsx` | GOWA URL configuration | ✅ Ready |
| `src/lib/store.ts` | Zustand state management | ✅ Ready |
| `src/lib/gowa-api.ts` | GOWA API client | ✅ Ready |
| `src/lib/webhook-parser.ts` | Parse GOWA webhook payloads | ✅ Ready |
| `src/hooks/useSSE.ts` | SSE hook for real-time updates | ✅ Ready |
| `src/types/whatsapp.ts` | TypeScript types for GOWA/WhatsApp | ✅ Ready |
| `.kilocode/` | AI context & recipes | ✅ Ready |

## Architecture

### Data Flow
1. GOWA receives WhatsApp messages and POSTs to `/api/webhook`
2. Webhook parses payload and broadcasts via SSE to all connected clients
3. Client's `useSSE` hook receives events and updates Zustand store
4. React components re-render with new messages

### Sending Messages
1. User types/selects media in `MessageInput`
2. Optimistic update added to store immediately
3. Request proxied through `/api/send` or `/api/send/media` to GOWA API
4. GOWA sends the actual WhatsApp message

### Image Annotations
- Click any image to open `ImageViewer`
- Toggle "Annotate" mode to draw rectangles on images
- Choose colors, add labels to annotations
- Annotations stored in Zustand store per message

## GOWA Setup

1. Run GOWA: `docker run -p 3000:3000 aldinokemal2104/go-whatsapp-web-multidevice`
2. Open Settings in the app, set GOWA URL to `http://localhost:3000`
3. Configure GOWA webhook to POST to `{app-url}/api/webhook`
4. Scan QR code in GOWA to connect WhatsApp

## Available Recipes

| Recipe | File | Use Case |
|--------|------|----------|
| Add Database | `.kilocode/recipes/add-database.md` | Data persistence with Drizzle + SQLite |

## Pending Improvements

- [ ] Persistent message storage with database (use add-database recipe)
- [ ] Group chat support improvements
- [ ] Message search within chat
- [ ] Contact list management
- [ ] QR code display for GOWA connection
- [ ] Audio recording for voice messages

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-02-27 | Full WhatsApp Web clone built with GOWA integration |
| 2026-02-27 | GOWA v8 support: device management, QR code login, fixed API endpoints |
| 2026-02-27 | Fixed QR code endpoint - query params now properly forwarded to GOWA |
| 2026-02-27 | Fixed confusing status label - changed "Connected" to "Live" to indicate SSE status, not WhatsApp connection |
| 2026-02-27 | Added resizable sidebar with draggable divider (280px - 600px range), width persists in localStorage |
| 2026-02-27 | Added download attachments feature - images, videos, audio files can be downloaded from chat |
| 2026-02-27 | Added backup & restore chat feature - export/import all chats and messages with media to JSON file |
| 2026-02-27 | Fixed device creation - added deviceId query param for GOWA auth |
| 2026-02-27 | Fixed confusing status label - changed "Connected" to "Live" to indicate SSE status, not WhatsApp connection |
| 2026-02-27 | Added resizable sidebar with draggable divider (280px - 600px range), width persists in localStorage |
| 2026-02-27 | Added message context menu with delete, forward, and reply options; messages can be forwarded to other chats |
| 2026-02-28 | Fixed webhook parser compatibility for GOWA v8 payload (`id/body/from_name/chat_id`) while preserving legacy format support |
| 2026-02-28 | Added initial history sync from GOWA (`/chats` + `/chat/{jid}/messages`) on app startup when local chats are empty |
| 2026-02-28 | Added browser notifications for incoming messages and fixed left-sidebar unread badge consistency |
| 2026-02-28 | Removed call/video header actions, added in-chat message search, and suppressed duplicate outgoing media placeholder text (e.g. "Image") |
| 2026-02-28 | Persisted outgoing image preview across refresh using data URL and enabled emoji picker in message input |
| 2026-02-28 | Added pre-send image editor in composer with crop rectangle and marker rectangle modes, applying edits into the uploaded image file |
| 2026-02-28 | Implemented New Message dialog with GOWA contact picker and manual phone number input to start chat |
| 2026-02-28 | Added clipboard image paste support (Ctrl+V) in message composer, converting pasted image to pending attachment preview |
| 2026-03-03 | Fixed `/api/gowa` proxy JSON parsing crash by handling non-JSON upstream responses (e.g. HTML error pages) and forwarding text payloads with original status/content-type |
