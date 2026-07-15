export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  JWT_SECRET: string;
  BCRYPT_ROUNDS: number;
  APP_URL: string;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  username: string;
  avatar?: string;
  lastSeen?: string;
  lastUsernameChange?: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  userId: string;
  contactId: string;
  displayName?: string;
  blocked: number;
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: 'DM' | 'GROUP';
  title?: string;
  avatar?: string;
  createdBy: string;
  createdAt: string;
}

export interface Participant {
  id: string;
  convId: string;
  userId: string;
  role: 'member' | 'admin';
  muted: number;
  joinedAt: string;
}

export interface Message {
  id: string;
  convId: string;
  senderId: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  content: string;
  metadata?: string;
  timestamp: string;
  editedAt?: string;
  deletedAt?: string;
}

export interface Media {
  id: string;
  userId: string;
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  size: number;
  duration?: number;
  createdAt: string;
}

export interface Story {
  id: string;
  userId: string;
  media: string;
  caption?: string;
  expiresAt: string;
  viewers: string;
  createdAt: string;
}

export type SortOrder = 'asc' | 'desc';
