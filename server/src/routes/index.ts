import { Hono } from "hono";
import { z } from "zod";
import { AppEnv } from "../config/env";
import { json } from "../utils/response";
import { signJWT, requireAuth } from "../middleware/auth";
import { hash, compare } from "bcryptjs";
import type { User, Message } from "../types";

const app = new Hono<{ Bindings: AppEnv }>();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(100),
  username: z
    .string()
    .regex(/^[a-zA-Z0-9_]{3,30}$/)
    .optional(),
});

app.post("/register", async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, { status: 400 });

  const { email, password, name, username } = parsed.data;
  const exists = await c.env.DB.prepare("SELECT id FROM users WHERE email = ? OR username = ?").bind(email, username).first();
  if (exists) return json({ error: "Email or username already taken" }, { status: 409 });

  const passwordHash = await hashAsync(password);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await c.env.DB.prepare(
    "INSERT INTO users (id, email, passwordHash, name, username, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, email, passwordHash, name, username ?? null, createdAt).run();

  const token = await signJWT({ sub: id }, c.env.JWT_SECRET);
  return json({ token, user: { id, email, name, username } }, { status: 201 });
});

app.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1).max(200) }).safeParse(body);
  if (!parsed.success) return json({ error: "Invalid input" }, { status: 400 });

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(parsed.data.email).first<User>();
  if (!user) return json({ error: "Invalid credentials" }, { status: 401 });

  const valid = await compareAsync(parsed.data.password, user.passwordHash);
  if (!valid) return json({ error: "Invalid credentials" }, { status: 401 });

  const token = await signJWT({ sub: user.id }, c.env.JWT_SECRET);
  return json({
    token,
    user: { id: user.id, email: user.email, name: user.name, username: user.username, avatar: user.avatar },
  });
});

app.get("/me", async (c) => {
  const auth = await requireAuth(c.req.raw, c.env);
  if (auth instanceof Response) return auth;

  const user = await c.env.DB.prepare("SELECT id, email, name, username, avatar, lastSeen FROM users WHERE id = ?").bind(auth.sub).first();
  if (!user) return json({ error: "Not found" }, { status: 404 });
  return json({ user });
});

app.patch("/me", async (c) => {
  const auth = await requireAuth(c.req.raw, c.env);
  if (auth instanceof Response) return auth;

  const body = await c.req.json();
  const patchSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    username: z
      .string()
      .regex(/^[a-zA-Z0-9_]{3,30}$/)
      .nullable()
      .optional(),
    avatar: z.string().url().nullable().optional(),
  });
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, { status: 400 });

  const updates: string[] = [];
  const values: unknown[] = [];
  const data = parsed.data;
  if (data.name !== undefined) { updates.push("name = ?"); values.push(data.name); }
  if (data.username !== undefined) {
    const collision = await c.env.DB.prepare("SELECT id FROM users WHERE username = ? AND id != ?")
      .bind(data.username, auth.sub)
      .first();
    if (collision) return json({ error: "Username taken" }, { status: 409 });
    updates.push("username = ?"); values.push(data.username);
  }
  if (data.avatar !== undefined) { updates.push("avatar = ?"); values.push(data.avatar); }

  if (!updates.length) return json({ error: "Nothing to update" }, { status: 400 });
  values.push(auth.sub);
  await c.env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();

  const user = await c.env.DB.prepare("SELECT id, email, name, username, avatar, lastSeen FROM users WHERE id = ?").bind(auth.sub).first();
  return json({ user });
});

app.get("/contacts", async (c) => {
  const auth = await requireAuth(c.req.raw, c.env);
  if (auth instanceof Response) return auth;

  const cursor = c.req.query("cursor");
  const limit = Number(c.req.query("limit") ?? "50");
  const query = `SELECT c.*, u.name AS contactName, u.username, u.avatar FROM contacts c JOIN users u ON c.contactId = u.id WHERE c.userId = ? ${cursor ? "AND c.id > ?" : ""} ORDER BY c.id DESC LIMIT ?`;
  const rows = cursor
    ? await c.env.DB.prepare(query).bind(auth.sub, cursor, limit).all()
    : await c.env.DB.prepare(query).bind(auth.sub, limit).all();
  return json({ contacts: rows.results });
});

app.post("/contacts", async (c) => {
  const auth = await requireAuth(c.req.raw, c.env);
  if (auth instanceof Response) return auth;

  const body = await c.req.json();
  const parsed = z.object({ username: z.string().min(1).max(30).optional(), contactId: z.string().uuid().optional() }).refine((v) => v.username || v.contactId, { message: "Provide username or contactId" }).safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, { status: 400 });

  const contactUser = parsed.data.username
    ? await c.env.DB.prepare("SELECT id, name, username, avatar FROM users WHERE username = ?").bind(parsed.data.username).first<User>()
    : await c.env.DB.prepare("SELECT id, name, username, avatar FROM users WHERE id = ?").bind(parsed.data.contactId).first<User>();

  if (!contactUser) return json({ error: "User not found" }, { status: 404 });
  if (contactUser.id === auth.sub) return json({ error: "Cannot add yourself" }, { status: 400 });

  const existing = await c.env.DB.prepare("SELECT id FROM contacts WHERE userId = ? AND contactId = ?").bind(auth.sub, contactUser.id).first();
  if (existing) return json({ error: "Already in contacts" }, { status: 409 });

  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO contacts (id, userId, contactId, displayName) VALUES (?, ?, ?, ?)").bind(id, auth.sub, contactUser.id, contactUser.name).run();
  return json({ id, contact: contactUser }, { status: 201 });
});

app.get("/conversations", async (c) => {
  const auth = await requireAuth(c.req.raw, c.env);
  if (auth instanceof Response) return auth;

  const rows = await c.env.DB.prepare(
    `SELECT c.*, p.role FROM participants p JOIN conversations c ON c.id = p.convId WHERE p.userId = ? ORDER BY c.createdAt DESC`
  ).bind(auth.sub).all();
  return json({ conversations: rows.results });
});

app.post("/conversations", async (c) => {
  const auth = await requireAuth(c.req.raw, c.env);
  if (auth instanceof Response) return auth;

  const body = await c.req.json();
  const parsed = z.object({ type: z.enum(["DM", "GROUP"]), title: z.string().max(200).optional(), contactUsername: z.string().min(1).max(30).optional() }).safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.type === "DM") {
    const contact = await c.env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(parsed.data.contactUsername).first();
    if (!contact) return json({ error: "Contact user not found" }, { status: 404 });

    const conv = await c.env.DB.prepare("SELECT c.id FROM conversations c JOIN participants p ON p.convId = c.id WHERE c.type = 'DM' AND p.userId = ? AND EXISTS (SELECT 1 FROM participants WHERE convId = c.id AND userId = ?)").bind(auth.sub, contact.id).first();
    if (conv) return json({ conversationId: conv.id });

    const convId = crypto.randomUUID();
    await c.env.DB.prepare("INSERT INTO conversations (id, type, createdBy, createdAt) VALUES (?, 'DM', ?, ?)").bind(convId, auth.sub, new Date().toISOString()).run();
    await c.env.DB.prepare("INSERT INTO participants (id, convId, userId, role) VALUES (?, ?, ?, 'member')").bind(crypto.randomUUID(), convId, auth.sub).run();
    await c.env.DB.prepare("INSERT INTO participants (id, convId, userId, role) VALUES (?, ?, ?, 'member')").bind(crypto.randomUUID(), convId, contact.id).run();
    return json({ conversationId: convId }, { status: 201 });
  }

  const convId = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO conversations (id, type, title, createdBy, createdAt) VALUES (?, 'GROUP', ?, ?, ?)").bind(convId, parsed.data.title, auth.sub, new Date().toISOString()).run();
  await c.env.DB.prepare("INSERT INTO participants (id, convId, userId, role) VALUES (?, ?, ?, 'admin')").bind(crypto.randomUUID(), convId, auth.sub).run();
  return json({ conversationId: convId }, { status: 201 });
});

app.get("/conversations/:id/messages", async (c) => {
  const auth = await requireAuth(c.req.raw, c.env);
  if (auth instanceof Response) return auth;

  const convId = c.req.param("id");
  const participant = await c.env.DB.prepare("SELECT id FROM participants WHERE convId = ? AND userId = ?").bind(convId, auth.sub).first();
  if (!participant) return json({ error: "Not a member" }, { status: 403 });

  const limit = Number(c.req.query("limit") ?? "50");
  const cursor = c.req.query("cursor");
  const query = `SELECT m.* FROM messages m WHERE m.convId = ? AND m.deletedAt IS NULL ${cursor ? "AND m.id > ?" : ""} ORDER BY m.timestamp DESC LIMIT ?`;
  const rows = cursor
    ? await c.env.DB.prepare(query).bind(convId, cursor, limit).all()
    : await c.env.DB.prepare(query).bind(convId, limit).all();
  return json({ messages: rows.results });
});

app.post("/conversations/:id/messages", async (c) => {
  const auth = await requireAuth(c.req.raw, c.env);
  if (auth instanceof Response) return auth;

  const convId = c.req.param("id");
  const participant = await c.env.DB.prepare("SELECT id FROM participants WHERE convId = ? AND userId = ?").bind(convId, auth.sub).first();
  if (!participant) return json({ error: "Not a member" }, { status: 403 });

  const body = await c.req.json();
  const parsed = z.object({ type: z.enum(["text", "image", "video", "audio", "file"]), content: z.string().min(1).max(5000), metadata: z.string().optional() }).safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, { status: 400 });

  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  await c.env.DB.prepare("INSERT INTO messages (id, convId, senderId, type, content, metadata, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, convId, auth.sub, parsed.data.type, parsed.data.content, parsed.data.metadata ?? null, timestamp).run();

  return json({ message: { id, convId, senderId: auth.sub, type: parsed.data.type, content: parsed.data.content, metadata: parsed.data.metadata, timestamp } }, { status: 201 });
});

app.patch("/messages/:id", async (c) => {
  const auth = await requireAuth(c.req.raw, c.env);
  if (auth instanceof Response) return auth;

  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM messages WHERE id = ?").bind(id).first<Message>();
  if (!row) return json({ error: "Not found" }, { status: 404 });
  if (row.senderId !== auth.sub) return json({ error: "Forbidden" }, { status: 403 });

  const body = await c.req.json();
  const parsed = z.object({ content: z.string().min(1).max(5000).optional() }).safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.flatten() }, { status: 400 });

  const editedAt = new Date().toISOString();
  await c.env.DB.prepare("UPDATE messages SET content = ?, editedAt = ? WHERE id = ?").bind(parsed.data.content, editedAt, id).run();
  return json({ ok: true, editedAt });
});

export default app;
