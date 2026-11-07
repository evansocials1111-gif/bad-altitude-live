"use client";
import { useRef } from "react";
import type { Emotion, ShowLine } from "@/lib/shared/types";

export type Side = 1 | -1; // which way the roommate is, on screen

export type PoseInput = {
  t: number; line: ShowLine | null; partnerLine: ShowLine | null; side: Side; actions: readonly IdleAction[];
};

export type IdleAction = { kind: string; every: number; dur: number };

export type Pose = {
  emotion: Emotion; yaw: number; lean: number; bounce: number; headDown: number; headRot: number;
  laughing: boolean; action: string | null; actionP: number; gesture: number; gazeOverride: { x: number; y: number } | null;
};

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

/** Decides what a person on the couch is doing this frame: who they look at, how they sit, what their hands are up to. */
export function usePose({ t, line, partnerLine, side, actions }: PoseInput): Pose {
  const eased = useRef({ yaw: 0, lean: 0, headDown: 0, gesture: 0 });
  const act = useRef<{ kind: string | null; start: number; dur: number; next: number }>({ kind: null, start: 0, dur: 0, next: 3 + Math.random() * 4 });

  const speaking = !!line;
  const listening = !!partnerLine;
  const toCamera = speaking && line!.kind === "answer";
  // A roommate laughs at about half of the other's jokes.
  const partnerFunny = listening && (partnerLine!.emotion === "happy" || partnerLine!.emotion === "smug" || partnerLine!.kind === "answer") && hash(partnerLine!.id) % 2 === 0;
  const laughing = (speaking && line!.emotion === "happy" && Math.sin(t * 0.8) > 0.3) || (partnerFunny && Date.now() - partnerLine!.startedAt > 900);

  // Idle business: drinks, phones, flexing. Never while talking.
  const a = act.current;
  if (speaking) a.kind = null;
  else if (!a.kind && t > a.next && actions.length) {
    const pick = actions[Math.floor(Math.random() * actions.length)];
    Object.assign(a, { kind: pick.kind, start: t, dur: pick.dur, next: t + pick.dur + pick.every * (0.6 + Math.random() * 0.8) });
  }
  if (a.kind && t - a.start > a.dur) a.kind = null;
  const actionP = a.kind ? Math.min(1, (t - a.start) / a.dur) : 0;

  let yaw = Math.sin(t * 0.31) * 0.2;
  if (listening) yaw = side * 0.85 + Math.sin(t * 0.9) * 0.08;
  else if (speaking && !toCamera) yaw = side * (0.45 + 0.35 * Math.sin(t * 0.8));
  else if (toCamera) yaw = Math.sin(t * 0.5) * 0.15;

  let lean = 0;
  if (listening) lean = side * 3.5;
  else if (speaking && !toCamera) lean = side * 2;
  const emotion: Emotion = speaking ? line!.emotion : laughing ? "happy" : listening && partnerLine!.emotion === "angry" ? "smug" : "neutral";
  if (emotion === "shocked") lean -= side * 3;
  if (emotion === "angry" && speaking) lean += side * 2;

  const phone = a.kind === "phone" ? Math.sin(Math.PI * actionP) : 0;
  const e = eased.current;
  e.yaw += (yaw - e.yaw) * 0.08;
  e.lean += (lean - e.lean) * 0.06;
  e.headDown += (phone * 1 - e.headDown) * 0.1;
  e.gesture += ((speaking ? 1 : 0) - e.gesture) * 0.08;

  const bounce = laughing ? Math.abs(Math.sin(t * 13)) * 5 : 0;
  const headRot = Math.sin(t * 0.37) * 1.5 + (speaking ? Math.sin(t * 3.1) * 2 : 0) + (laughing ? -4 * side : 0) + e.headDown * 4 * side;

  return {
    emotion, yaw: e.yaw, lean: e.lean, bounce, headDown: e.headDown, headRot, laughing,
    action: a.kind, actionP, gesture: e.gesture,
    gazeOverride: e.headDown > 0.4 ? { x: 0.1 * side, y: 0.95 } : listening ? { x: side * 0.85, y: 0.05 } : toCamera ? { x: 0, y: 0 } : null,
  };
}

/** Two-bone arm. Angles in degrees: a1 swings the upper arm outward from hanging down, a2 is the forearm's absolute angle. */
export function arm(sx: number, sy: number, out: Side, a1: number, a2: number, l1: number, l2: number) {
  const r = Math.PI / 180;
  const ex = sx + out * Math.sin(a1 * r) * l1, ey = sy + Math.cos(a1 * r) * l1;
  const hx = ex + out * Math.sin(a2 * r) * l2, hy = ey + Math.cos(a2 * r) * l2;
  return { ex, ey, hx, hy };
}
