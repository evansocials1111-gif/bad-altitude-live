"use client";
import type { Emotion, Viseme } from "@/lib/shared/types";

export const INK = "#14121a";
export const STROKE = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/** Mouth shapes. When silent, the emotion picks the resting expression. */
export function Mouth({ cx, cy, w = 22, viseme, emotion, speaking, lip = "#7c2d2d" }: { cx: number; cy: number; w?: number; viseme: Viseme; emotion: Emotion; speaking: boolean; lip?: string }) {
  const h = w / 2;
  if (!speaking || viseme === "X") {
    if (speaking) return <path d={`M${cx - h * 0.6} ${cy} H${cx + h * 0.6}`} {...STROKE} fill="none" />;
    switch (emotion) {
      case "happy": return <path d={`M${cx - h} ${cy - 3} Q${cx} ${cy + 10} ${cx + h} ${cy - 3}`} {...STROKE} fill="none" />;
      case "angry": return <path d={`M${cx - h} ${cy + 4} Q${cx} ${cy - 6} ${cx + h} ${cy + 4}`} {...STROKE} fill="none" />;
      case "sad": return <path d={`M${cx - h * 0.8} ${cy + 5} Q${cx} ${cy - 3} ${cx + h * 0.8} ${cy + 5}`} {...STROKE} fill="none" />;
      case "smug": return <path d={`M${cx - h} ${cy + 2} Q${cx + h * 0.2} ${cy + 4} ${cx + h} ${cy - 5}`} {...STROKE} fill="none" />;
      case "shocked": return <ellipse cx={cx} cy={cy + 2} rx={h * 0.5} ry={h * 0.7} fill={INK} />;
      default: return <path d={`M${cx - h * 0.8} ${cy + 1} Q${cx} ${cy + 3} ${cx + h * 0.8} ${cy}`} {...STROKE} fill="none" />;
    }
  }
  switch (viseme) {
    case "A": return <g><ellipse cx={cx} cy={cy + 3} rx={h} ry={h * 0.85} fill={INK} /><ellipse cx={cx} cy={cy + h * 0.6 + 3} rx={h * 0.6} ry={h * 0.3} fill={lip} /></g>;
    case "E": return <g><rect x={cx - h} y={cy - 3} width={w} height={h * 0.8} rx={4} fill={INK} /><rect x={cx - h + 2.5} y={cy - 2} width={w - 5} height={h * 0.3} rx={1.5} fill="#f4efe6" /></g>;
    case "O": return <ellipse cx={cx} cy={cy + 2} rx={h * 0.55} ry={h * 0.72} fill={INK} />;
    case "M": return <path d={`M${cx - h * 0.7} ${cy + 1} H${cx + h * 0.7}`} stroke={INK} strokeWidth={5} strokeLinecap="round" />;
    default: return null;
  }
}

/** A pair of eyes with blinking and a pupil offset. `lid` draws them half closed for tired characters. */
export function Eyes({ lx, rx, y, r = 9, blink, pupil = 3.6, look = 0, lid = 0, skin = "#e0b08c", emotion }: { lx: number; rx: number; y: number; r?: number; blink: boolean; pupil?: number; look?: number; lid?: number; skin?: string; emotion: Emotion }) {
  const scale = emotion === "shocked" ? 1.22 : 1;
  const lidAmount = emotion === "smug" ? Math.max(lid, 0.4) : emotion === "angry" ? Math.max(lid, 0.2) : lid;
  const eye = (x: number) => blink ? (
    <path key={x} d={`M${x - r} ${y} Q${x} ${y + 3} ${x + r} ${y}`} {...STROKE} fill="none" />
  ) : (
    <g key={x}>
      <circle cx={x} cy={y} r={r * scale} fill="#fbf9f4" />
      <circle cx={x + look} cy={y + 0.5} r={pupil} fill={INK} />
      {lidAmount > 0 && <path d={`M${x - r * scale - 1} ${y} A${r * scale + 1} ${r * scale + 1} 0 0 1 ${x + r * scale + 1} ${y} L${x + r * scale + 1} ${y - r * scale * (1 - lidAmount)} L${x - r * scale - 1} ${y - r * scale * (1 - lidAmount)} Z`} fill={skin} transform={`translate(0 ${r * scale * lidAmount * 0.7})`} />}
    </g>
  );
  return <g>{eye(lx)}{eye(rx)}</g>;
}

export function Brows({ lx, rx, y, w = 12, emotion, color = INK, thick = 5 }: { lx: number; rx: number; y: number; w?: number; emotion: Emotion; color?: string; thick?: number }) {
  const tilt = { neutral: 0, happy: -2, angry: 7, shocked: -3, smug: 2, sad: -6 }[emotion];
  const lift = { neutral: 0, happy: -3, angry: 2, shocked: -9, smug: -1, sad: -2 }[emotion];
  const raise = emotion === "smug" ? -7 : 0;
  return (
    <g stroke={color} strokeWidth={thick} strokeLinecap="round">
      <line x1={lx - w} y1={y + lift - tilt} x2={lx + w} y2={y + lift + tilt} />
      <line x1={rx - w} y1={y + lift + tilt + raise} x2={rx + w} y2={y + lift - tilt + raise} />
    </g>
  );
}
