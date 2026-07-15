import { z } from "zod";

export const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(100),
  username: z.string().regex(/^[a-zA-Z0-9_]{3,30}$/).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const contactSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string().max(100).optional(),
});

export const conversationSchema = z.object({
  type: z.enum(["DM", "GROUP"]),
  title: z.string().max(200).optional(),
  createdBy: z.string().uuid(),
});

export const participantSchema = z.object({
  convId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["member", "admin"]).default("member"),
});

export const messageSchema = z.object({
  convId: z.string().uuid(),
  senderId: z.string().uuid(),
  type: z.enum(["text", "image", "video", "audio", "file"]),
  content: z.string().min(1).max(5000),
  metadata: z.string().optional(),
});

export const mediaUploadSchema = z.object({
  type: z.enum(["image", "video", "audio", "file"]),
  size: z.number().max(50 * 1024 * 1024), // 50MB max
});

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});
