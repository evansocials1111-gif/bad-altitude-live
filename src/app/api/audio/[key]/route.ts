import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!/^[a-f0-9]{40}$/.test(key)) return new Response("not found", { status: 404 });
  try {
    const data = await readFile(path.join(process.cwd(), ".data", "audio", `${key}.mp3`));
    return new Response(new Uint8Array(data), { headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=31536000, immutable" } });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
