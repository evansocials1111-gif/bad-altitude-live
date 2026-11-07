"use client";
import type { Expression } from "./live";

/** One eye: almond lid shape, wet sclera, layered iris, catchlight, lash line and crease. */
export function Eye({ id, cx, cy, rx, ry, iris, open, gaze, lash = "#2a1a12", skinShadow, scale = 1, side }: {
  id: string; cx: number; cy: number; rx: number; ry: number; iris: string; open: number;
  gaze: { x: number; y: number }; lash?: string; skinShadow: string; scale?: number; side: 1 | -1;
}) {
  const up = Math.max(0.04, open);
  const top = cy - ry * 1.9 * up + (1 - up) * ry * 0.5;
  const bottom = cy + ry * 1.25;
  const lid = `M${cx - rx} ${cy} Q${cx - rx * 0.1 * side} ${top} ${cx + rx} ${cy - 1} Q${cx + rx * 0.1 * side} ${bottom} ${cx - rx} ${cy} Z`;
  const ix = cx + gaze.x * rx * 0.45;
  const iy = cy + gaze.y * ry * 0.5 + (1 - up) * ry * 0.3;
  const ir = ry * 1.02;
  return (
    <g transform={scale !== 1 ? `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})` : undefined}>
      <defs>
        <clipPath id={`${id}-lid`}><path d={lid} /></clipPath>
        <radialGradient id={`${id}-scl`} cx="50%" cy="55%" r="60%"><stop offset="0" stopColor="#f6f1ea" /><stop offset=".7" stopColor="#e4d9cf" /><stop offset="1" stopColor="#b9a294" /></radialGradient>
        <radialGradient id={`${id}-iris`}><stop offset="0" stopColor="#140d08" /><stop offset=".32" stopColor="#140d08" /><stop offset=".36" stopColor={iris} /><stop offset=".8" stopColor={iris} stopOpacity=".85" /><stop offset="1" stopColor="#1d1510" /></radialGradient>
      </defs>
      {/* Socket shadow */}
      <ellipse cx={cx} cy={cy - ry * 0.6} rx={rx * 1.35} ry={ry * 2.1} fill={skinShadow} opacity=".28" />
      <path d={lid} fill={`url(#${id}-scl)`} />
      <g clipPath={`url(#${id}-lid)`}>
        <circle cx={ix} cy={iy} r={ir} fill={`url(#${id}-iris)`} />
        <circle cx={ix + ir * 0.35} cy={iy - ir * 0.38} r={ir * 0.22} fill="#fff" opacity=".9" />
        {/* Upper lid casts a shadow on the eye */}
        <path d={`M${cx - rx} ${cy} Q${cx} ${top} ${cx + rx} ${cy - 1} L${cx + rx} ${top - 4} L${cx - rx} ${top - 4} Z`} fill="#000" opacity=".22" transform={`translate(0 ${ry * 0.55})`} />
      </g>
      <path d={`M${cx - rx - 1} ${cy + 0.5} Q${cx - rx * 0.1 * side} ${top} ${cx + rx + 1} ${cy - 1.5}`} fill="none" stroke={lash} strokeWidth={2.6} strokeLinecap="round" />
      <path d={`M${cx - rx + 2} ${cy + 1} Q${cx + rx * 0.1 * side} ${bottom} ${cx + rx - 1} ${cy}`} fill="none" stroke={lash} strokeOpacity=".35" strokeWidth={1} />
      {/* Lid crease rides up when the eye opens wide */}
      <path d={`M${cx - rx * 0.9} ${cy - ry * 0.9} Q${cx} ${top - ry * 0.9 - 2} ${cx + rx * 0.95} ${cy - ry}`} fill="none" stroke={skinShadow} strokeOpacity=".55" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  );
}

/** A brow. Positive tilt pulls the inner end down (anger). */
export function Brow({ cx, cy, len, thick, color, expr, side, extra = 0 }: {
  cx: number; cy: number; len: number; thick: number; color: string; expr: Expression; side: 1 | -1; extra?: number;
}) {
  // side = -1 for the brow on the viewer's left, whose inner end is on the right.
  const y = cy - expr.brow - extra;
  const inner = cx - (side * len) / 2;
  const outer = cx + (side * len) / 2;
  const d = `M${outer} ${y + 3} Q${cx + side * len * 0.15} ${y - thick * 0.9} ${inner} ${y + 1} L${inner} ${y + thick * 0.7} Q${cx} ${y + thick * 0.25} ${outer} ${y + 4} Z`;
  return <path d={d} fill={color} opacity=".92" transform={`rotate(${expr.tilt * -side} ${cx} ${y})`} />;
}

/** Lips, teeth and tongue. Opens from viseme data and curves with the expression. */
export function Mouth({ id, cx, cy, w, lip, lipDark, open, wide, expr }: {
  id: string; cx: number; cy: number; w: number; lip: string; lipDark: string; open: number; wide: number; expr: Expression;
}) {
  const ww = w * wide;
  const h = open * w * 0.42 + expr.jaw * 10;
  const l = cx - ww / 2;
  const r = cx + ww / 2;
  const cl = cy - 6 * expr.smile;
  const cr = cy - 6 * expr.smile - 5 * expr.asym;
  const innerTop = cy - 1 - h * 0.18;
  const innerBot = cy + h;
  const inner = `M${l + 3} ${cl} Q${cx} ${innerTop - 1} ${r - 3} ${cr} Q${cx} ${innerBot + 3} ${l + 3} ${cl} Z`;
  return (
    <g>
      <defs>
        <clipPath id={`${id}-in`}><path d={inner} /></clipPath>
        <linearGradient id={`${id}-lip`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={lipDark} /><stop offset=".55" stopColor={lip} /><stop offset="1" stopColor={lipDark} /></linearGradient>
      </defs>
      {/* Philtrum and the shadow under the lower lip */}
      <path d={`M${cx - 5} ${cy - 18} Q${cx} ${cy - 12} ${cx - 3} ${cy - 7} M${cx + 5} ${cy - 18} Q${cx} ${cy - 12} ${cx + 3} ${cy - 7}`} fill="none" stroke={lipDark} strokeOpacity=".25" strokeWidth={1.4} />
      <ellipse cx={cx} cy={innerBot + 13} rx={ww * 0.3} ry={4} fill={lipDark} opacity=".22" />
      {h > 1.2 && (
        <>
          <path d={inner} fill="#2b0f10" />
          <g clipPath={`url(#${id}-in)`}>
            <rect x={l} y={innerTop - 2} width={ww} height={Math.min(8, h * 0.45) + 2} rx={2} fill="#ece4d6" />
            <path d={`M${cx - 0.5} ${innerTop} V${innerTop + 8}`} stroke="#c8bba8" strokeWidth={0.8} />
            <ellipse cx={cx} cy={innerBot + 2} rx={ww * 0.32} ry={h * 0.35} fill="#a2444a" />
          </g>
        </>
      )}
      {/* Upper lip with cupid's bow */}
      <path d={`M${l} ${cl} Q${cx - ww / 4} ${cy - 10} ${cx} ${cy - 6} Q${cx + ww / 4} ${cy - 10} ${r} ${cr} Q${cx} ${innerTop + 1} ${l} ${cl} Z`} fill={`url(#${id}-lip)`} />
      {/* Lower lip */}
      <path d={`M${l + 2} ${cl + 0.5} Q${cx} ${innerBot + 1} ${r - 2} ${cr + 0.5} Q${cx} ${innerBot + 12} ${l + 2} ${cl + 0.5} Z`} fill={`url(#${id}-lip)`} />
      <ellipse cx={cx + 2} cy={innerBot + 5} rx={ww * 0.13} ry={1.6} fill="#fff" opacity=".22" />
      {h <= 1.2 && <path d={`M${l} ${cl} Q${cx} ${cy + 1} ${r} ${cr}`} fill="none" stroke="#3a1414" strokeWidth={1.6} strokeLinecap="round" />}
      {/* Corners dimple with a smile */}
      <path d={`M${l - 3} ${cl - 3} q-2 4 1 7 M${r + 3} ${cr - 3} q2 4 -1 7`} fill="none" stroke={lipDark} strokeOpacity={0.15 + Math.max(0, expr.smile) * 0.3} strokeWidth={1.4} />
    </g>
  );
}
