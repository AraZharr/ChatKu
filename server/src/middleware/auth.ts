import { AppEnv } from "../config/env";

const AUTHZ = "Bearer ";

export function bearerAuthHeader(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith(AUTHZ)) return null;
  return h.slice(AUTHZ.length).trim();
}

export async function requireAuth(req: Request, env: AppEnv): Promise<{ sub: string } | Response> {
  const token = bearerAuthHeader(req);
  if (!token) return new Response(JSON.stringify({ error: "Missing token" }), { status: 401, headers: { "content-type": "application/json" } });
  try {
    const payload = await verifyJWT(token, env.JWT_SECRET);
    return { sub: payload.sub };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { "content-type": "application/json" } });
  }
}

export async function verifyJWT(token: string, secret: string): Promise<{ sub: string; exp: number }> {
  const data = new TextEncoder().encode(`${secret}.${token}`);
  const signature = await crypto.subtle.importKey("raw", data, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const [headerB64, payloadB64, sigB64] = token.split(".");
  const header = JSON.parse(atob(headerB64.replace(/-/g, "+").replace(/_/g, "/")));
  const alg = header.alg as string;
  if (alg !== "HS256") throw new Error("Unsupported alg");
  const encoder = new TextEncoder();
  const sig = Uint8Array.from(atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
  const verifier = await crypto.subtle.importKey("raw", encoder.encode(`${headerB64}.${payloadB64}`), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const valid = await crypto.subtle.verify({ name: "HMAC", hash: "SHA-256" }, key, sig, encoder.encode(`${headerB64}.${payloadB64}`));
  if (!valid) throw new Error("Invalid signature");
  const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error("Expired");
  return payload;
}

export async function signJWT(payload: { sub: string; exp?: number }, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { sub: payload.sub, exp: payload.exp ?? now + 60 * 60 * 24 * 7, iat: now };
  const encode = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  const headerB64 = encode(header);
  const payloadB64 = encode(body);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "HMAC", hash: "SHA-256" }, key, data);
  const sigArr = Array.from(new Uint8Array(sig));
  const sigB64 = btoa(String.fromCharCode(...sigArr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  return `${headerB64}.${payloadB64}.${sigB64}`;
}
