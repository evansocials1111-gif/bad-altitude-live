import { clientIp } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";
import { getQueue } from "@/lib/server/queue";
import { setViewers, showState, subscribe } from "@/lib/server/show/bus";
import { startDirector } from "@/lib/server/show/director";
import type { StreamEvent } from "@/lib/shared/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try { rateLimit(`stream:${clientIp(req)}`, 30, 30); } catch { return new Response("rate limited", { status: 429 }); }
  startDirector();
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const initialQueue = await getQueue().catch(() => []);

  const stream = new ReadableStream({
    start(controller) {
      const send = (e: StreamEvent | { type: "ping" }) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`)); } catch { cleanup(); }
      };
      setViewers(1);
      send({ type: "status", status: { ...showState.status, viewers: showState.viewers } });
      send({ type: "presence", viewers: showState.viewers });
      send({ type: "queue", queue: initialQueue });
      if (showState.lastLine && Date.now() - showState.lastLine.startedAt < showState.lastLine.durationMs) send({ type: "line", line: showState.lastLine });
      const unsubscribe = subscribe(send);
      const heartbeat = setInterval(() => send({ type: "ping" }), 20000);
      let closed = false;
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        setViewers(-1);
        try { controller.close(); } catch {}
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
}
