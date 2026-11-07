"use client";
import { useEffect, useRef, useState } from "react";
import { visemeAt } from "@/lib/shared/visemes";
import type { Emotion, ShowLine, Viseme } from "@/lib/shared/types";

/** Seconds since mount, updated about 30 times a second. Paused when the tab is hidden. */
export function useClock() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now() - Math.random() * 10_000;
    let raf = 0;
    let last = 0;
    const step = (now: number) => {
      if (now - last > 32) { last = now; setT((now - start) / 1000); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return t;
}

/** Natural blinking: irregular gaps, the odd double blink. Returns lid openness 0..1. */
export function useBlink(t: number) {
  const next = useRef({ at: 2 + Math.random() * 3, double: false });
  const n = next.current;
  if (t > n.at + 0.32) {
    n.double = !n.double && Math.random() < 0.18;
    n.at = t + (n.double ? 0.25 : 1.8 + Math.random() * 4.2);
  }
  const d = t - n.at;
  if (d < 0 || d > 0.32) return 1;
  // Fast close, slower open.
  return d < 0.09 ? 1 - d / 0.09 : Math.min(1, (d - 0.09) / 0.23);
}

/** Small eye movements: mostly at the camera, sometimes away, sometimes toward the other caller. */
export function useGaze(t: number, toward: number, attentive: boolean) {
  const target = useRef({ x: 0, y: 0, until: 0 });
  const cur = useRef({ x: 0, y: 0 });
  const g = target.current;
  if (t > g.until) {
    const r = Math.random();
    if (attentive || r < 0.55) { g.x = (Math.random() - 0.5) * 0.25; g.y = (Math.random() - 0.5) * 0.2; }
    else if (r < 0.8) { g.x = toward * (0.6 + Math.random() * 0.3); g.y = (Math.random() - 0.3) * 0.3; }
    else { g.x = (Math.random() - 0.5) * 1.4; g.y = (Math.random() - 0.6) * 0.8; }
    g.until = t + 0.6 + Math.random() * (attentive ? 1.6 : 2.6);
  }
  // Saccades are quick.
  cur.current.x += (g.x - cur.current.x) * 0.45;
  cur.current.y += (g.y - cur.current.y) * 0.45;
  return cur.current;
}

export type Expression = { brow: number; tilt: number; smile: number; open: number; jaw: number; headTilt: number; asym: number };

const EXPR: Record<Emotion, Expression> = {
  neutral: { brow: 0, tilt: 0, smile: 0.12, open: 1, jaw: 0, headTilt: 0, asym: 0 },
  happy: { brow: 3, tilt: -2, smile: 1, open: 0.78, jaw: 0.12, headTilt: -2.5, asym: 0 },
  angry: { brow: -5, tilt: 10, smile: -0.7, open: 0.85, jaw: 0, headTilt: 1.5, asym: 0 },
  shocked: { brow: 9, tilt: -3, smile: -0.25, open: 1.3, jaw: 0.4, headTilt: -1, asym: 0 },
  smug: { brow: 1, tilt: 0, smile: 0.6, open: 0.72, jaw: 0, headTilt: 3.5, asym: 1 },
  sad: { brow: 2, tilt: -9, smile: -0.8, open: 0.82, jaw: 0, headTilt: 2.5, asym: 0 },
};

/** Eases between expressions so faces never snap. */
export function useExpression(emotion: Emotion) {
  const cur = useRef<Expression>({ ...EXPR.neutral });
  const target = EXPR[emotion] ?? EXPR.neutral;
  for (const k of Object.keys(target) as (keyof Expression)[]) cur.current[k] += (target[k] - cur.current[k]) * 0.1;
  return cur.current;
}

const OPEN: Record<Viseme, { open: number; wide: number }> = {
  X: { open: 0, wide: 1 }, M: { open: 0, wide: 0.96 }, A: { open: 1, wide: 1 }, E: { open: 0.45, wide: 1.12 }, O: { open: 0.75, wide: 0.72 },
};

/** Mouth shape from the line's viseme timeline, smoothed like a real jaw. */
export function useMouth(t: number, line: ShowLine | null) {
  const cur = useRef({ open: 0, wide: 1 });
  let target = OPEN.X;
  if (line) {
    const elapsed = Date.now() - line.startedAt;
    if (elapsed < line.durationMs) target = OPEN[visemeAt(line.visemes, elapsed)];
  }
  const jitter = target.open > 0 ? 0.85 + 0.15 * Math.sin(t * 23) : 1;
  cur.current.open += (target.open * jitter - cur.current.open) * 0.5;
  cur.current.wide += (target.wide - cur.current.wide) * 0.4;
  return cur.current;
}

/** Shared idle and talking motion for a head. */
export function headMotion(t: number, speaking: boolean, expr: Expression, toward: number, listening: boolean) {
  const turn = listening ? toward * 0.55 : 0;
  const yaw = Math.sin(t * 0.43) * 0.35 + Math.sin(t * 1.1) * 0.12 + turn + (speaking ? Math.sin(t * 2.3) * 0.18 : 0);
  const x = Math.sin(t * 0.5) * 3 + Math.sin(t * 1.3) * 1.2 + yaw * 4;
  const nod = speaking ? Math.abs(Math.sin(t * 4.2)) * 2.4 : 0;
  const y = Math.sin(t * 0.7) * 1.6 + nod - expr.jaw * 3;
  const rot = Math.sin(t * 0.37) * 1.4 + expr.headTilt + (speaking ? Math.sin(t * 3.1) * 1.1 : 0);
  const breathe = Math.sin(t * 1.6);
  return { yaw, x, y, rot, breathe };
}
