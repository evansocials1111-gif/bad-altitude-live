import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "./errors";
import { config } from "./config";
import { log } from "./log";
import { rateLimit } from "./ratelimit";

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** Rejects cross-site state-changing requests. SameSite=Lax cookies are the first layer, this is the second. */
function assertSameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // Non-browser clients carry no ambient cookies to abuse.
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (new URL(origin).host !== host && origin !== config.appUrl) {
    throw new ApiError(403, "bad_origin", "Cross-origin request refused.");
  }
}

export function route<C = unknown>(
  handler: (req: Request, ctx: C) => Promise<unknown>,
  opts: { limit?: [capacity: number, perMinute: number] } = {},
) {
  return async (req: Request, ctx: C) => {
    try {
      assertSameOrigin(req);
      const [capacity, perMinute] = opts.limit ?? [120, 240];
      rateLimit(`${new URL(req.url).pathname}:${req.method}:${clientIp(req)}`, capacity, perMinute);
      const result = await handler(req, ctx);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { headers: { "cache-control": "no-store" } });
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ error: e.code, message: e.message, ...e.extra }, { status: e.status });
      }
      if (e instanceof z.ZodError) {
        return NextResponse.json({ error: "invalid_input", message: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
      }
      log("error", "api.unhandled", { path: new URL(req.url).pathname, message: (e as Error).message });
      return NextResponse.json({ error: "server_error", message: "Something broke on our side." }, { status: 500 });
    }
  };
}

export async function body<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  const text = await req.text();
  if (text.length > 20000) throw new ApiError(413, "too_large", "Request too large.");
  let json: unknown;
  try { json = text ? JSON.parse(text) : {}; } catch { throw new ApiError(400, "invalid_json", "Invalid JSON."); }
  return schema.parse(json);
}
