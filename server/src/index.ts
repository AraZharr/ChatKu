import { AppEnv } from "../config/env";
import api from "./routes";

export default {
  async fetch(request: Request, env: AppEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api")) {
      return api.fetch(request, env, ctx);
    }

    // Serve a simple health JSON
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", service: "chatku" }), {
        headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<AppEnv>;

