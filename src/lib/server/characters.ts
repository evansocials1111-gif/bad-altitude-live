import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import { q } from "./db";
import type { CharacterRow } from "./ai/prompts";

/** Licensed roster entries stay dark unless the deployment explicitly declares it holds the license. */
export async function getActiveCharacters() {
  const rows = await q<CharacterRow>(`select * from characters where active=true order by sort_order`);
  return rows.filter((c) => c.license_status === "original" || config.licensedRosterEnabled);
}

/** Optional filmed footage: public/characters/<id>/idle.mp4 and talking.mp4 (or .webm). Real clips replace the drawn face. */
function findClips(id: string) {
  const found: { idle?: string; talking?: string } = {};
  for (const kind of ["idle", "talking"] as const) {
    for (const ext of ["mp4", "webm", "mov"]) {
      if (fs.existsSync(path.join(process.cwd(), "public", "characters", id, `${kind}.${ext}`))) { found[kind] = `/characters/${id}/${kind}.${ext}`; break; }
    }
  }
  return found.idle && found.talking ? found : null;
}

export function publicCharacter(c: CharacterRow) {
  return {
    id: c.id, name: c.name, tagline: c.tagline, rig: c.animation_config?.rig ?? c.id, accent: c.animation_config?.accent ?? null,
    face: c.animation_config?.face ?? null, room: c.animation_config?.room ?? null, clips: findClips(c.id),
    voice: { pitch: c.voice_config?.browserPitch ?? 1, rate: c.voice_config?.browserRate ?? 1, gender: c.voice_config?.browserGender ?? null },
  };
}

const EMOTIONS = ["neutral", "happy", "angry", "shocked", "smug", "sad"];

export type SceneClips = { idle: string[]; talking: Record<string, { any: string[]; plain: string[]; byEmotion: Record<string, string[]> }> };

/**
 * Real footage of the shared couch, if the operator has filmed it. Files in public/scene/ named
 * idle[-N].mp4 and <character>[-emotion][-N].mp4 (for example tanner-angry-2.mp4). Without at least
 * one idle clip and one talking clip per character, the drawn scene is used.
 */
export function findSceneClips(ids: string[]): SceneClips | null {
  const dir = path.join(process.cwd(), "public", "scene");
  let files: string[] = [];
  try { files = fs.readdirSync(dir).sort(); } catch { return null; }
  const out: SceneClips = { idle: [], talking: Object.fromEntries(ids.map((id) => [id, { any: [], plain: [], byEmotion: {} }])) };
  const re = new RegExp(`^(idle|${ids.join("|")})(?:-(${EMOTIONS.join("|")}))?(?:-\\d+)?\\.(mp4|webm|mov)$`, "i");
  for (const f of files) {
    const m = f.match(re);
    if (!m) continue;
    const url = `/scene/${encodeURIComponent(f)}`;
    const who = m[1].toLowerCase();
    if (who === "idle") { out.idle.push(url); continue; }
    const t = out.talking[who];
    t.any.push(url);
    if (m[2]) (t.byEmotion[m[2].toLowerCase()] ??= []).push(url);
    else t.plain.push(url);
  }
  return out.idle.length && ids.every((id) => out.talking[id].any.length) ? out : null;
}
