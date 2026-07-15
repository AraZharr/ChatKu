export interface AppEnv {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  JWT_SECRET: string;
  BCRYPT_ROUNDS: string;
  APP_URL: string;
}

export function parseEnv(c: { [key: string]: string | undefined }): AppEnv {
  return {
    DB: c.DB as unknown as D1Database,
    KV: c.KV as unknown as KVNamespace,
    R2: c.R2 as unknown as R2Bucket,
    JWT_SECRET: c.JWT_SECRET ?? "change-me",
    BCRYPT_ROUNDS: c.BCRYPT_ROUNDS ?? "10",
    APP_URL: c.APP_URL ?? "http://localhost:8787",
  };
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
    ...init,
  });
}

export function badRequest(message: string): Response {
  return json({ error: message }, { status: 400 });
}

export function unauthorized(message = "Unauthorized"): Response {
  return json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden"): Response {
  return json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found"): Response {
  return json({ error: message }, { status: 404 });
}

export function serverError(message = "Internal server error"): Response {
  return json({ error: message }, { status: 500 });
}
