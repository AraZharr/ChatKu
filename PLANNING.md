# ChatKu Planning
Stack: Kotlin Native. Target: WA + Discord + Messenger hybrid.

## Tujuan
- Chat 1:1 (WA style)
- Group chat + channel (Discord style)
- Stories/status (Messenger style)
- Self-hosted backend preferred
- **NO PHONE NUMBERS** — auth via email only untuk privacy

## Arsitektur

### Frontend
- **Tech:** Kotlin + Jetpack Compose Multiplatform (Android/iOS)
- **State:** ViewModel + Flow
- **DB local:** SQLite via Room
- **Network:** Ktor client (WebSocket + REST)

### Backend (confirmed: B)
- **Stack:** Node.js + Socket.IO + Express
- **DB:** SQLite (better-sqlite3) atau PostgreSQL
- **Auth:** JWT + email verification (no SMS/phone)
- **Realtime:** Socket.IO rooms untuk chat
- **API:** REST + WebSocket hybrid

### Infracase (self-host)
- 1 vCPU / 1GB RAM minimal
- Nginx reverse proxy
- TLS via Let's Encrypt / Cloudflare

### Infracase (kalau self-host)
- 1 vCPU / 1GB RAM minimal
- Nginx reverse proxy
- TLS via Let's Encrypt / Cloudflare

## Fitur by Priority

### P0 (MVP)
- [ ] Auth (phone/email)
- [ ] 1:1 chat text + media
- [ ] Group chat
- [ ] Online/last seen
- [ ] End-to-end encryption (opsional tapi penting)

### P1
- [ ] Voice call (WebRTC)
- [ ] Video call (WebRTC)
- [ ] Status/stories 24h
- [ ] Read receipt + typing indicator

### P2
- [ ] Channels + threads (Discord style)
- [ ] Bot API / webhook
- [ ] Pin + bookmark + search
- [ ] Multi-account
- [ ] Theme custom + dark/light

### P3
- [ ] Screen sharing
- [ ] Poll + event
- [ ] End-to-end encrypted backup
- [ ] Desktop client (Compose Multiplatform)

## Data Model

```
User { id, phone/email, name, avatar, publicKey, createdAt }
Contact { userId, contactId, displayName, blocked }
Conversation { id, type: [DM | GROUP | CHANNEL], title, avatar, createdBy, createdAt }
Message { id, convId, senderId, type, content, metadata, timestamp, editedAt }
Participant { convId, userId, role, muted, joinedAt }
Story { userId, media, caption, expiresAt, viewers[] }
```

## Username Policy
- User bisa set **@username** unik saat register atau nanti
- Bisa ganti username **1x per 3 bulan**
- Saat ganti username:
  - Tampilkan warning toast: "Username akan terekspos ke semua kontakmu"
  - Confirm dialog sebelum submit
  - Rate limit: cooldown 3 bulan
- Username ditampilkan di: profile, chat header, contact list
- Search kontak by username exact match

## Admin Panel (P2, post-MVP)
- Web dashboard buat admin manage app
- Fitur minimal:
  - List users + ban/unban
  - Delete reported content (chat/media/posts)
  - View basic stats (DAU, messages sent)
- Implement: simple HTML/JS served dari Worker + D1 queries
- Auth: admin JWT only, no public access
- Skip v1, prioritize after core chat works

## Security
- TLS everywhere (Cloudflare handles this)
- Auth: JWT + email OTP (no SMS)
- Rate limiting + abuse protection
- E2EE: skip for v1, plan for v2

## Backend Structure

```
/server
  /src
    /config          # env + settings
    /models          # SQLite schema
    /routes          # REST endpoints
    /sockets         # Socket.IO handlers
    /middleware       # auth, rate-limit, validation
    /services        # business logic
    /utils           # helpers
  /migrations        # DB versioning
  package.json
  Dockerfile
  .env.example
```

### REST Endpoints (auth + account)
| Method | Path | Desc |
|--------|------|------|
| POST | /api/auth/register | Email + password |
| POST | /api/auth/login | Return JWT |
| POST | /api/auth/verify-email | OTP verify |
| POST | /api/auth/forgot-password | Reset link |
| GET | /api/users/me | Profile |
| PATCH | /api/users/me | Update profile |
| POST | /api/users/avatar | Upload avatar |

### REST Endpoints (contacts)
| Method | Path | Desc |
|--------|------|------|
| GET | /api/contacts | List contacts |
| POST | /api/contacts | Add by email/username |
| DELETE | /api/contacts/:id | Remove |
| PATCH | /api/contacts/:id | Block/mute |

### REST Endpoints (conversations + messages)
| Method | Path | Desc |
|--------|------|------|
| GET | /api/conversations | List all chats |
| POST | /api/conversations | Create DM or group |
| GET | /api/conversations/:id/messages | Paginated history |
| POST | /api/conversations/:id/messages | Send message |
| PATCH | /api/messages/:id | Edit/delete |
| POST | /api/messages/:id/read | Mark read |

### REST Endpoints (media)
| Method | Path | Desc |
|--------|------|------|
| POST | /api/media/upload | Upload image/video/audio |
| GET | /api/media/:id | Download/signed URL |

### WebSocket Events (Socket.IO)
| Event | Direction | Desc |
|-------|-----------|------|
| join | client→server | Join conversation room |
| leave | client→server | Leave room |
| message:send | client→server | Send realtime message |
| message:new | server→client | New message broadcast |
| typing:start | client→server | Typing indicator |
| typing:stop | client→server | Stop typing |
| online | server→client | Contact online status |
| read | client→server | Mark messages read |
| call:offer | client→server | WebRTC offer |
| call:answer | client→server | WebRTC answer |
| call:ice | both | ICE candidates |

### Data Model
```
User { id, email, passwordHash, name, avatar, lastSeen, createdAt }
Contact { id, userId, contactId, displayName, blocked, createdAt }
Conversation { id, type: DM|GROUP, title, avatar, createdBy, createdAt }
Participant { id, convId, userId, role, muted, joinedAt }
Message { id, convId, senderId, type, content, metadata, timestamp, editedAt, deletedAt }
Media { id, userId, type, url, size, duration, createdAt }
Story { id, userId, media, caption, expiresAt, viewers, createdAt }
```

### Frontend Requirements
- Compose Multiplatform: Android + iOS
- Responsive breakpoints:
  - Phone: 1-pane chat
  - Tablet 7": 2-pane conversation list + detail
  - Foldable: adaptive layout with `WindowSizeClass`
- Dark/light theme support
- Accessibility labels + TalkBack
- Offline-first: show cached chat + queue message when offline

### Frontend Structure
```
/app
  /src
    /common         # shared models, utils
    /androidApp     # Android main
    /iosApp         # iOS main
    /features
      /auth         # login, register, forgot
      /chat         # conversation list + detail
      /contacts     # contact list + profile
      /media        # camera, gallery, preview
      /story        # story camera + viewer
      /call         # voice/video call UI
    /theme          # dark/light, colors, typography
    /network        # Ktor client, WS, auth interceptor
    /db             # Room entities, DAO, migrations
```

## Deploy Plan
- Host: VPS 1 vCPU / 1GB RAM
- DB: SQLite file di volume
- Proxy: Nginx → Socket.IO upgrade enabled
- TLS: Cloudflare Tunnel / certbot
- Backup: `/root/backup.sh` style daily ke MEGA
- CI/CD: GitHub Actions → build Docker → deploy SSH

## Next Step
Scaffold backend di `/root/work2/server` dengan:
1. Express + Socket.IO + better-sqlite3
2. Auth flow (register/login/JWT)
3. 1:1 chat MVP (REST + WS)
- CF Tunnel / nginx reverse proxy
- DB backup harian ke MEGA

## Next Step
Pilih backend stack + bahasa confirm sebelum gue scaffold project.
