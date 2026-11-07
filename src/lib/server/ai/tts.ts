import { createHash } from "node:crypto";
import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import { log } from "../log";
import { getSetting } from "../settings";
import { alignmentToVisemes, estimateDurationMs, textToVisemes } from "../../shared/visemes";
import type { VisemeCue } from "../../shared/types";
import { recordUsage, ttsBudgetLeft } from "./usage";

export type Speech = { audioUrl: string | null; visemes: VisemeCue[]; durationMs: number; provider: string };

const AUDIO_DIR = path.join(process.cwd(), ".data", "audio");
const USD_PER_1K_CHARS = 0.1; // Rough ElevenLabs overage rate. Confirm against your plan.

async function storeAudio(key: string, mp3: Buffer, meta: { visemes: VisemeCue[]; durationMs: number }) {
  await mkdir(AUDIO_DIR, { recursive: true });
  const saveMeta = (audioUrl: string) => writeFile(path.join(AUDIO_DIR, `${key}.json`), JSON.stringify({ ...meta, audioUrl }));
  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    const objectUrl = `${config.supabaseUrl}/storage/v1/object/${config.supabaseAudioBucket}/${key}.mp3`;
    const res = await fetch(objectUrl, {
      method: "POST",
      headers: { authorization: `Bearer ${config.supabaseServiceRoleKey}`, "content-type": "audio/mpeg", "x-upsert": "true" },
      body: new Uint8Array(mp3),
    });
    if (!res.ok) throw new Error(`Supabase Storage HTTP ${res.status}`);
    const url = `${config.supabaseUrl}/storage/v1/object/public/${config.supabaseAudioBucket}/${key}.mp3`;
    await saveMeta(url);
    return url;
  }
  await writeFile(path.join(AUDIO_DIR, `${key}.mp3`), mp3);
  const url = `/api/audio/${key}`;
  await saveMeta(url);
  return url;
}

/**
 * Real voice when ElevenLabs is configured for the character and within budget. Otherwise returns no audio:
 * the viewer's browser speaks the line, the provider field says so, and mouth timing is estimated from the text.
 */
export async function synthesize(text: string, voice: any): Promise<Speech> {
  const rate = Number(voice?.browserRate ?? 1);
  const browser = (): Speech => {
    const durationMs = estimateDurationMs(text, rate);
    return { audioUrl: null, visemes: textToVisemes(text, durationMs), durationMs, provider: "browser" };
  };
  const voiceId = voice?.elevenlabsVoiceId;
  if (!config.elevenLabsApiKey || !voiceId) return browser();
  if (!(await getSetting("ai")).ttsEnabled || !(await ttsBudgetLeft())) return browser();

  const key = createHash("sha256").update(`${voiceId}:${config.elevenLabsModel}:${text}`).digest("hex").slice(0, 40);
  try {
    // Local cache hit: identical lines never pay twice.
    const metaPath = path.join(AUDIO_DIR, `${key}.json`);
    const cached = await access(metaPath).then(() => true).catch(() => false);
    if (cached) {
      const meta = JSON.parse(await readFile(metaPath, "utf8"));
      return { audioUrl: meta.audioUrl, visemes: meta.visemes, durationMs: meta.durationMs, provider: "elevenlabs-cache" };
    }
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`, {
      method: "POST",
      headers: { "xi-api-key": config.elevenLabsApiKey, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: config.elevenLabsModel }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`ElevenLabs HTTP ${res.status}`);
    const data = await res.json();
    const al = data.alignment;
    const endSec = al.character_end_times_seconds[al.character_end_times_seconds.length - 1];
    const visemes = alignmentToVisemes(al.characters, al.character_start_times_seconds, endSec);
    const durationMs = Math.round(endSec * 1000) + 200;
    const audioUrl = await storeAudio(key, Buffer.from(data.audio_base64, "base64"), { visemes, durationMs });
    await recordUsage({ kind: "tts", provider: "elevenlabs", model: config.elevenLabsModel, input: text.length, output: 0, costUsd: (text.length / 1000) * USD_PER_1K_CHARS });
    return { audioUrl, visemes, durationMs, provider: "elevenlabs" };
  } catch (e) {
    log("warn", "tts.failed", { message: (e as Error).message });
    return browser();
  }
}
