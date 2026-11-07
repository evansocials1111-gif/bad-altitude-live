import type { Viseme, VisemeCue } from "./types";

const MAP: Record<string, Viseme> = {
  a: "A", h: "A", i: "E", e: "E", y: "E", s: "E", z: "E", t: "E", d: "E", n: "E", c: "E", g: "E", k: "E", r: "E", l: "E", j: "E", x: "E",
  o: "O", u: "O", w: "O", q: "O", m: "M", b: "M", p: "M", f: "M", v: "M",
};

export function charToViseme(ch: string): Viseme {
  return MAP[ch.toLowerCase()] ?? "X";
}

export function estimateDurationMs(text: string, rate = 1) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(((words * 340 + (text.match(/[.,!?;:…]/g)?.length ?? 0) * 170) / rate) + 500);
}

/** Text-driven mouth timeline, used when the voice provider returns no timing data. */
export function textToVisemes(text: string, durationMs: number): VisemeCue[] {
  const chars = [...text];
  if (!chars.length) return [];
  const step = durationMs / chars.length;
  const cues: VisemeCue[] = [];
  chars.forEach((ch, i) => {
    const v = charToViseme(ch);
    const last = cues[cues.length - 1];
    if (last?.v === v) return;
    const t = Math.round(i * step);
    if (last && t - last.t < 60) return;
    cues.push({ t, v });
  });
  cues.push({ t: durationMs, v: "X" });
  return cues;
}

/** Character-level timing from a TTS provider (for example ElevenLabs alignment). */
export function alignmentToVisemes(chars: string[], startsSec: number[], endSec: number): VisemeCue[] {
  const cues: VisemeCue[] = [];
  chars.forEach((ch, i) => {
    const v = charToViseme(ch);
    const t = Math.round(startsSec[i] * 1000);
    const last = cues[cues.length - 1];
    if (last?.v === v) return;
    if (last && t - last.t < 50) return;
    cues.push({ t, v });
  });
  cues.push({ t: Math.round(endSec * 1000), v: "X" });
  return cues;
}

export function visemeAt(cues: VisemeCue[], elapsedMs: number): Viseme {
  let lo = 0, hi = cues.length - 1, best: Viseme = "X";
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].t <= elapsedMs) { best = cues[mid].v; lo = mid + 1; } else hi = mid - 1;
  }
  return best;
}
