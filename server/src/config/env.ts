export interface AppEnv {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  JWT_SECRET: string;
  APP_URL: string;
}

export function parseEnv(c: { [key: string]: string | undefined }): AppEnv {
  return {
    DB: c.DB as unknown as D1Database,
    KV: c.KV as unknown as KVNamespace,
    R2: c.R2 as unknown as R2Bucket,
    JWT_SECRET: c.JWT_SECRET ?? "change-me",
    APP_URL: c.APP_URL ?? "http://localhost:8787",
  };
}
