"use client";
import { memo, useId, useRef } from "react";
import type { ShowLine } from "@/lib/shared/types";
import { Brow, Eye, Mouth } from "../call/features";
import { useBlink, useClock, useExpression, useGaze, useMouth } from "../call/live";
import { arm, usePose, type IdleAction, type Pose, type Side } from "./pose";

type PersonProps = { t: number; line: ShowLine | null; partnerLine: ShowLine | null; side: Side };

/** Everything a face needs this frame, from the pose. */
function useFace(t: number, line: ShowLine | null, pose: Pose, side: Side) {
  const expr = useExpression(pose.emotion);
  const open = useBlink(t) * expr.open * (pose.laughing ? 0.55 : 1);
  const saccade = useGaze(t, side, !!line);
  const gaze = pose.gazeOverride ? { x: pose.gazeOverride.x + saccade.x * 0.3, y: pose.gazeOverride.y + saccade.y * 0.3 } : saccade;
  const mouth = useMouth(t, line);
  const laughOpen = pose.laughing && !line ? 0.35 + 0.35 * Math.abs(Math.sin(t * 13)) : 0;
  return { expr, open, gaze, mouth: { open: Math.max(mouth.open, laughOpen), wide: mouth.wide } };
}

function Limb({ x1, y1, x2, y2, w, color, hi }: { x1: number; y1: number; x2: number; y2: number; w: number; color: string; hi?: string }) {
  return (
    <>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={w} strokeLinecap="round" />
      {hi && <line x1={x1 - w * 0.18} y1={y1} x2={x2 - w * 0.18} y2={y2} stroke={hi} strokeWidth={w * 0.3} strokeLinecap="round" opacity=".35" />}
    </>
  );
}

const TANNER_ACTIONS: IdleAction[] = [{ kind: "drink", every: 9, dur: 2.6 }, { kind: "flex", every: 16, dur: 2.2 }, { kind: "phone", every: 12, dur: 3 }];

/** Tanner: 24, ex-lineman, backwards cap, gold chain, energy drink permanently in hand. */
function Tanner({ t, line, partnerLine, side }: PersonProps) {
  const id = useId().replace(/:/g, "");
  const pose = usePose({ t, line, partnerLine, side, actions: TANNER_ACTIONS });
  const { expr, open, gaze, mouth } = useFace(t, line, pose, side);
  const skin = "#d39a74", shade = "#8f5a3e", hi = "#efc09c";
  const f = pose.yaw * 9;
  const breathe = Math.sin(t * 1.5) * 1.5;

  // Right hand (screen right) holds the can: drinks, or gestures while talking.
  const drink = pose.action === "drink" ? Math.sin(Math.PI * pose.actionP) : 0;
  const flex = pose.action === "flex" ? Math.sin(Math.PI * pose.actionP) : 0;
  const g = pose.gesture;
  const rA1 = 14 + drink * 30 + g * (12 + Math.sin(t * 4.1) * 14) + flex * 70;
  const rA2 = -150 - drink * 22 + g * (40 + Math.sin(t * 5.3) * 25) + flex * 10;
  const R = arm(304, 392, 1, rA1, rA2, 118, 108);
  // Left hand rests on the couch, then jabs at the camera or at Jade when he gets going.
  const lA1 = 22 + g * (8 + Math.sin(t * 3.3 + 1) * 10) + flex * 75;
  const lA2 = 10 - g * (80 + Math.sin(t * 4.4) * 20) - flex * 150;
  const L = arm(96, 392, -1, lA1, lA2, 118, 108);
  const headTilt = pose.headRot - drink * 9;

  return (
    <g transform={`rotate(${pose.lean} 200 700) translate(0 ${pose.bounce * 0.6 + breathe})`}>
      <defs>
        <radialGradient id={`${id}-skin`} cx="44%" cy="38%" r="65%"><stop offset="0" stopColor={hi} /><stop offset=".55" stopColor={skin} /><stop offset="1" stopColor={shade} /></radialGradient>
        <linearGradient id={`${id}-tank`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7d828c" /><stop offset="1" stopColor="#3c3f47" /></linearGradient>
        <linearGradient id={`${id}-cap`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e2343e" /><stop offset="1" stopColor="#7a1018" /></linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2a1206" stopOpacity=".4" /><stop offset=".3" stopColor="#2a1206" stopOpacity="0" /><stop offset=".72" stopColor="#2a1206" stopOpacity="0" /><stop offset="1" stopColor="#2a1206" stopOpacity=".45" /></linearGradient>
        <clipPath id={`${id}-head`}><path d="M200 98 C152 98 130 130 128 174 C126 210 128 240 140 268 C152 300 174 324 200 326 C226 324 248 300 260 268 C272 240 274 210 272 174 C270 130 248 98 200 98 Z" /></clipPath>
      </defs>

      {/* Traps, delts, tank top */}
      <path d="M150 330 Q200 350 250 330 L300 392 L100 392 Z" fill={skin} />
      <circle cx="96" cy="400" r="50" fill={`url(#${id}-skin)`} />
      <circle cx="304" cy="400" r="50" fill={`url(#${id}-skin)`} />
      <path d="M126 360 Q200 400 274 360 L300 760 L100 760 Z" fill={`url(#${id}-tank)`} />
      <path d="M150 360 Q200 420 250 360" fill="none" stroke="#2c2e34" strokeWidth="6" />
      <path d="M160 336 Q200 392 240 336" fill="none" stroke="#e7c24f" strokeWidth="5" />
      <path d="M160 336 Q200 392 240 336" fill="none" stroke="#fff3b5" strokeWidth="1.5" strokeDasharray="3 5" />
      <path d="M172 340 Q200 360 228 340" fill="none" stroke={shade} strokeWidth="10" opacity=".35" />

      {/* Neck */}
      <path d="M164 280 L236 280 L246 352 Q200 372 154 352 Z" fill={skin} />
      <path d="M164 300 Q200 330 236 300 L240 330 Q200 350 160 330 Z" fill={shade} opacity=".45" />

      {/* Head */}
      <g transform={`translate(${pose.yaw * 6} ${pose.headDown * 10 - expr.jaw * 2}) rotate(${headTilt} 200 330)`}>
        <ellipse cx={128 - f * 0.5} cy="212" rx="13" ry="24" fill={skin} />
        <ellipse cx={272 - f * 0.5} cy="212" rx="13" ry="24" fill={skin} />
        <path d="M200 98 C152 98 130 130 128 174 C126 210 128 240 140 268 C152 300 174 324 200 326 C226 324 248 300 260 268 C272 240 274 210 272 174 C270 130 248 98 200 98 Z" fill={`url(#${id}-skin)`} />
        <g clipPath={`url(#${id}-head)`}>
          <rect x="110" y="90" width="180" height="250" fill={`url(#${id}-side)`} transform={`translate(${f} 0)`} />
          {/* Fade: dark on top, skin showing through at the sides */}
          <path d="M120 176 C118 120 160 104 200 104 C244 104 284 122 280 176 C270 160 262 150 256 150 L144 150 C138 150 128 160 120 176 Z" fill="#2b1d14" opacity=".9" />
          {/* Beard shadow and stubble */}
          <path d={`M138 238 C150 300 176 326 200 326 C224 326 250 300 262 238 C252 262 240 280 230 286 Q200 300 170 286 C160 280 148 262 138 238 Z`} fill="#3a2516" opacity=".32" transform={`translate(${f} 0)`} />
          <g fill="#2e1d10" opacity=".35" transform={`translate(${f} 0)`}>
            {Array.from({ length: 160 }, (_, i) => {
              const ang = ((i * 137.5) % 360) * (Math.PI / 180), r = 20 + ((i * 53) % 64);
              const x = 200 + Math.cos(ang) * r * 1.15, y = 290 + Math.sin(ang) * r * 0.55;
              return y > 250 ? <circle key={i} cx={x} cy={y} r=".9" /> : null;
            })}
          </g>
        </g>
        {/* Backwards cap */}
        <path d="M126 170 C118 104 158 80 200 80 C244 80 284 104 274 170 C254 150 146 150 126 170 Z" fill={`url(#${id}-cap)`} />
        <path d="M140 156 Q200 140 260 156" fill="none" stroke="#5a0b10" strokeWidth="5" />
        <rect x="186" y="146" width="28" height="12" rx="3" fill="#2b1d14" />
        <path d="M150 96 Q200 82 250 96" fill="none" stroke="#ff8a8f" strokeWidth="3" opacity=".35" />

        <g transform={`translate(${f} 0)`}>
          <Eye id={`${id}-el`} cx={170} cy={200} rx={14} ry={7} iris="#5a3a22" open={open} gaze={gaze} skinShadow={shade} side={-1} />
          <Eye id={`${id}-er`} cx={230} cy={200} rx={14} ry={7} iris="#5a3a22" open={open} gaze={gaze} skinShadow={shade} side={1} />
          <Brow cx={168} cy={180} len={38} thick={9} color="#2b1d14" expr={expr} side={-1} extra={expr.asym * 6} />
          <Brow cx={232} cy={180} len={38} thick={9} color="#2b1d14" expr={expr} side={1} />
          <path d="M194 206 Q190 234 184 246 M206 206 Q210 234 216 246" fill="none" stroke={shade} strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
          <path d="M200 204 Q202 226 200 240" stroke={hi} strokeWidth="4" strokeLinecap="round" opacity=".55" />
          <ellipse cx="200" cy="248" rx="15" ry="10" fill={skin} />
          <ellipse cx="198" cy="244" rx="6" ry="3.5" fill={hi} opacity=".7" />
          <ellipse cx="191" cy="254" rx="4.5" ry="2.6" fill="#40200f" opacity=".75" />
          <ellipse cx="209" cy="254" rx="4.5" ry="2.6" fill="#40200f" opacity=".75" />
          <Mouth id={`${id}-m`} cx={200} cy={282} w={56} lip="#b06a58" lipDark="#6e3628" open={mouth.open} wide={mouth.wide} expr={expr} />
        </g>
      </g>

      {/* Arms in front of the body */}
      <Limb x1={96} y1={392} x2={L.ex} y2={L.ey} w={46} color={skin} hi={hi} />
      <Limb x1={L.ex} y1={L.ey} x2={L.hx} y2={L.hy} w={38} color={skin} hi={hi} />
      <circle cx={L.hx} cy={L.hy} r="21" fill={shade} />
      <Limb x1={304} y1={392} x2={R.ex} y2={R.ey} w={46} color={skin} hi={hi} />
      <Limb x1={R.ex} y1={R.ey} x2={R.hx} y2={R.hy} w={38} color={skin} hi={hi} />
      {flex > 0.3 && <circle cx={(304 + R.ex) / 2} cy={(392 + R.ey) / 2 - 6} r={22 + flex * 8} fill={hi} opacity=".5" />}
      <g transform={`translate(${R.hx} ${R.hy}) rotate(${-drink * 70})`}>
        <rect x="-15" y="-40" width="30" height="62" rx="6" fill="#9be33b" />
        <rect x="-15" y="-40" width="30" height="8" rx="3" fill="#c9cfd6" />
        <path d="M-8 -20 L4 -6 L-4 -6 L8 10" stroke="#111" strokeWidth="4" fill="none" />
        <circle r="20" fill={skin} cx="0" cy="0" />
      </g>
    </g>
  );
}

const JADE_ACTIONS: IdleAction[] = [{ kind: "phone", every: 7, dur: 3.4 }, { kind: "hair", every: 14, dur: 1.8 }, { kind: "nails", every: 12, dur: 2.6 }];

/** Jade: 25, bartender, winged liner, gold hoops, phone in hand at all times. */
function Jade({ t, line, partnerLine, side }: PersonProps) {
  const id = useId().replace(/:/g, "");
  const pose = usePose({ t, line, partnerLine, side, actions: JADE_ACTIONS });
  const { expr, open, gaze, mouth } = useFace(t, line, pose, side);
  const skin = "#b47c5a", shade = "#7a4a32", hi = "#d9a07e";
  const f = pose.yaw * 9;
  const breathe = Math.sin(t * 1.7) * 1.3;
  const g = pose.gesture;
  const phone = pose.action === "phone" ? Math.sin(Math.PI * pose.actionP) : 0;
  const hair = pose.action === "hair" ? Math.sin(Math.PI * pose.actionP) : 0;
  const nails = pose.action === "nails" ? Math.sin(Math.PI * pose.actionP) : 0;

  // Left hand (screen left, toward Tanner) holds the phone; it shoves him when she's angry at him.
  const shove = line?.kind !== "answer" && pose.emotion === "angry" ? 1 : 0;
  const lA1 = 10 + phone * 6 - shove * 35 + g * Math.sin(t * 3.7) * 6;
  const lA2 = -128 - phone * 20 - shove * 40 + nails * 30;
  const L = arm(124, 384, -1, lA1, lA2, 106, 98);
  // Right hand talks: flicks, points, inspects nails, flips hair.
  const rA1 = 12 + g * (16 + Math.sin(t * 4.6) * 12) + hair * 70 + nails * 10;
  const rA2 = -110 + g * (30 + Math.sin(t * 5.9 + 1) * 30) - hair * 70 - nails * 30;
  const R = arm(276, 384, 1, rA1, rA2, 106, 98);
  const hairSwing = hair * 10;

  return (
    <g transform={`rotate(${pose.lean} 200 700) translate(0 ${pose.bounce * 0.6 + breathe})`}>
      <defs>
        <radialGradient id={`${id}-skin`} cx="46%" cy="38%" r="64%"><stop offset="0" stopColor={hi} /><stop offset=".58" stopColor={skin} /><stop offset="1" stopColor={shade} /></radialGradient>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4a3226" /><stop offset=".5" stopColor="#1f1410" /><stop offset="1" stopColor="#0f0a08" /></linearGradient>
        <linearGradient id={`${id}-hood`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#35303c" /><stop offset="1" stopColor="#17151b" /></linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#24100a" stopOpacity=".4" /><stop offset=".3" stopColor="#24100a" stopOpacity="0" /><stop offset=".72" stopColor="#24100a" stopOpacity="0" /><stop offset="1" stopColor="#24100a" stopOpacity=".4" /></linearGradient>
        <radialGradient id={`${id}-blush`}><stop offset="0" stopColor="#d65a6a" stopOpacity=".3" /><stop offset="1" stopColor="#d65a6a" stopOpacity="0" /></radialGradient>
        <clipPath id={`${id}-head`}><path d="M200 104 C158 104 136 136 136 180 C136 222 146 258 164 284 C178 304 190 312 200 312 C210 312 222 304 236 284 C254 258 264 222 264 180 C264 136 242 104 200 104 Z" /></clipPath>
      </defs>

      {/* Long hair behind */}
      <g transform={`translate(${pose.yaw * 4} ${pose.headDown * 8}) rotate(${pose.headRot * 0.6} 200 330)`}>
        <path d={`M118 190 C104 96 160 66 205 68 C256 68 300 100 286 196 C296 290 300 420 ${300 + hairSwing} 560 L236 560 C246 450 258 330 254 252 L146 252 C142 330 152 450 162 560 L${100 - hairSwing} 560 C96 420 106 290 118 190 Z`} fill={`url(#${id}-hair)`} />
      </g>

      {/* Hoodie */}
      <path d="M118 368 Q200 330 282 368 L310 760 L90 760 Z" fill={`url(#${id}-hood)`} />
      <path d="M140 352 Q200 410 260 352 Q240 396 200 404 Q160 396 140 352 Z" fill="#0f0d12" />
      <path d="M182 404 L178 470 M218 404 L222 470" stroke="#ff8fb8" strokeWidth="3" strokeLinecap="round" />
      <circle cx="124" cy="388" r="34" fill={`url(#${id}-hood)`} />
      <circle cx="276" cy="388" r="34" fill={`url(#${id}-hood)`} />

      <path d="M176 280 L224 280 L230 350 Q200 362 170 350 Z" fill={skin} />
      {/* Hair falling over her shoulders, in front of the hoodie */}
      <g transform={`translate(${pose.yaw * 5} ${pose.headDown * 8})`}>
        <path d={`M138 236 C122 300 116 380 ${128 - hairSwing} 470 C140 480 156 470 160 456 C152 390 154 320 164 268 Z`} fill={`url(#${id}-hair)`} />
        <path d={`M262 236 C278 300 284 380 ${272 + hairSwing} 470 C260 480 244 470 240 456 C248 390 246 320 236 268 Z`} fill={`url(#${id}-hair)`} />
        <path d="M134 280 C128 340 130 400 136 452 M266 280 C272 340 270 400 264 452" stroke="#6b4a38" strokeWidth="2" fill="none" opacity=".45" />
      </g>
      <path d="M176 296 Q200 322 224 296 L226 324 Q200 340 174 324 Z" fill={shade} opacity=".45" />

      {/* Head */}
      <g transform={`translate(${pose.yaw * 6} ${pose.headDown * 12 - expr.jaw * 2}) rotate(${pose.headRot} 200 330)`}>
        <ellipse cx={136 - f * 0.5} cy="214" rx="11" ry="20" fill={skin} />
        <ellipse cx={264 - f * 0.5} cy="214" rx="11" ry="20" fill={skin} />
        <circle cx={136 - f * 0.5} cy={246 + Math.sin(t * 2) * 1.5} r="13" fill="none" stroke="#e8c25a" strokeWidth="3" />
        <circle cx={264 - f * 0.5} cy={246 + Math.sin(t * 2 + 1) * 1.5} r="13" fill="none" stroke="#e8c25a" strokeWidth="3" />
        <path d="M200 104 C158 104 136 136 136 180 C136 222 146 258 164 284 C178 304 190 312 200 312 C210 312 222 304 236 284 C254 258 264 222 264 180 C264 136 242 104 200 104 Z" fill={`url(#${id}-skin)`} />
        <g clipPath={`url(#${id}-head)`}>
          <rect x="120" y="96" width="160" height="230" fill={`url(#${id}-side)`} transform={`translate(${f} 0)`} />
          <ellipse cx={160 + f} cy="246" rx="22" ry="14" fill={`url(#${id}-blush)`} />
          <ellipse cx={240 + f} cy="246" rx="22" ry="14" fill={`url(#${id}-blush)`} />
        </g>
        <g transform={`translate(${f} 0)`}>
          <Eye id={`${id}-el`} cx={172} cy={202} rx={14} ry={7.5} iris="#3b2414" open={open} gaze={gaze} skinShadow={shade} lash="#0c0706" side={-1} />
          <Eye id={`${id}-er`} cx={228} cy={202} rx={14} ry={7.5} iris="#3b2414" open={open} gaze={gaze} skinShadow={shade} lash="#0c0706" side={1} />
          {/* Winged liner */}
          <path d="M157 201 L148 194 M243 200 L252 193" stroke="#0c0706" strokeWidth="2.6" strokeLinecap="round" />
          <Brow cx={170} cy={183} len={34} thick={5.5} color="#1c120d" expr={expr} side={-1} extra={expr.asym * 7} />
          <Brow cx={230} cy={183} len={34} thick={5.5} color="#1c120d" expr={expr} side={1} />
          <path d="M196 208 Q193 234 190 244 M204 208 Q207 234 210 244" fill="none" stroke={shade} strokeOpacity=".3" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M200 206 Q201 226 200 238" stroke={hi} strokeWidth="3" strokeLinecap="round" opacity=".6" />
          <ellipse cx="200" cy="246" rx="11" ry="8" fill={skin} />
          <ellipse cx="199" cy="243" rx="4.5" ry="2.6" fill={hi} opacity=".8" />
          <ellipse cx="194" cy="251" rx="3.4" ry="2" fill="#3c1c10" opacity=".7" />
          <ellipse cx="206" cy="251" rx="3.4" ry="2" fill="#3c1c10" opacity=".7" />
          <Mouth id={`${id}-m`} cx={200} cy={276} w={44} lip="#b4525e" lipDark="#6e2a33" open={mouth.open} wide={mouth.wide} expr={expr} />
        </g>
        {/* Curtain bangs */}
        <path d="M200 86 C168 88 140 108 134 150 C130 180 132 220 140 260 C144 210 150 160 172 128 C182 114 194 104 200 98 Z" fill={`url(#${id}-hair)`} />
        <path d="M200 86 C232 88 260 108 266 150 C270 180 268 220 260 260 C256 210 250 160 228 128 C218 114 206 104 200 98 Z" fill={`url(#${id}-hair)`} />
        <path d="M180 96 C160 110 148 140 144 180 M222 96 C244 110 254 140 258 180" stroke="#7a5642" strokeWidth="2" fill="none" opacity=".5" />
      </g>

      {/* Arms, sleeves, hands, nails, phone */}
      <Limb x1={124} y1={384} x2={L.ex} y2={L.ey} w={40} color="#0c0b0f" />
      <Limb x1={L.ex} y1={L.ey} x2={L.hx} y2={L.hy} w={34} color="#0c0b0f" />
      <Limb x1={124} y1={384} x2={L.ex} y2={L.ey} w={36} color="#4a4453" hi="#8d84a0" />
      <Limb x1={L.ex} y1={L.ey} x2={L.hx} y2={L.hy} w={30} color="#4a4453" hi="#8d84a0" />
      <Limb x1={276} y1={384} x2={R.ex} y2={R.ey} w={40} color="#0c0b0f" />
      <Limb x1={R.ex} y1={R.ey} x2={R.hx} y2={R.hy} w={34} color="#0c0b0f" />
      <Limb x1={276} y1={384} x2={R.ex} y2={R.ey} w={36} color="#4a4453" hi="#8d84a0" />
      <Limb x1={R.ex} y1={R.ey} x2={R.hx} y2={R.hy} w={30} color="#4a4453" hi="#8d84a0" />
      <g transform={`translate(${L.hx} ${L.hy}) rotate(${-20 - phone * 25})`}>
        <rect x="-18" y="-40" width="36" height="64" rx="7" fill="#0d0d10" stroke="#3a3a44" strokeWidth="2" />
        <rect x="-15" y="-36" width="30" height="56" rx="4" fill="#5d7fff" opacity={0.35 + phone * 0.45} />
        <circle r="15" fill={skin} cx="0" cy="8" />
        <ellipse cx="-12" cy="-2" rx="3" ry="6" fill="#ff5fa2" />
      </g>
      <g transform={`translate(${R.hx} ${R.hy})`}>
        <circle r="15" fill={skin} />
        {[-9, -3, 3, 9].map((x) => <ellipse key={x} cx={x} cy={-15} rx="2.6" ry="6" fill="#ff5fa2" />)}
      </g>
      {/* Phone light on her face when she looks down */}
      {phone > 0.2 && <ellipse cx="200" cy="260" rx="70" ry="60" fill="#8fb0ff" opacity={phone * 0.12} />}
    </g>
  );
}

/** The apartment. Drawn once; it never moves. */
const Room = memo(function Room({ id }: { id: string }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a1838" /><stop offset=".35" stopColor="#1a1222" /><stop offset="1" stopColor="#0e0b12" /></linearGradient>
        <linearGradient id={`${id}-led`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff3fa4" stopOpacity=".75" /><stop offset="1" stopColor="#ff3fa4" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${id}-couch`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4b5a3a" /><stop offset="1" stopColor="#222a1a" /></linearGradient>
        <radialGradient id={`${id}-window`} cx="50%" cy="50%" r="70%"><stop offset="0" stopColor="#253a6e" /><stop offset="1" stopColor="#0a1024" /></radialGradient>
        <filter id={`${id}-soft`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5" /></filter>
        <filter id={`${id}-bokeh`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9" /></filter>
      </defs>
      <rect width="1600" height="900" fill={`url(#${id}-wall)`} />
      <g filter={`url(#${id}-soft)`}>
        <rect x="0" y="0" width="1600" height="150" fill={`url(#${id}-led)`} />
        {/* Window with city lights */}
        <rect x="1250" y="110" width="250" height="300" rx="6" fill={`url(#${id}-window)`} />
        <path d="M1375 110 V410 M1250 260 H1500" stroke="#0c0a10" strokeWidth="10" />
        {/* Poster */}
        <rect x="110" y="120" width="190" height="260" rx="4" fill="#d9ff3d" opacity=".85" />
        <circle cx="205" cy="230" r="58" fill="#111" />
        <rect x="140" y="320" width="130" height="20" fill="#111" />
        {/* Shelf, plant, speaker */}
        <rect x="1080" y="300" width="140" height="10" fill="#3a2a22" />
        <ellipse cx="1120" cy="270" rx="40" ry="34" fill="#2f6b3a" />
        <rect x="1160" y="250" width="40" height="50" rx="6" fill="#111" />
        {/* LED reflections */}
        <rect x="0" y="830" width="1600" height="70" fill="#ff3fa4" opacity=".12" />
      </g>
      <g filter={`url(#${id}-bokeh)`}>
        {[[1290, 160, "#ffd27a"], [1330, 330, "#ff8f6b"], [1440, 180, "#9ad2ff"], [1460, 320, "#ffd27a"], [1300, 380, "#c99bff"], [1420, 250, "#ffe0a0"]].map(([x, y, c], i) => <circle key={i} cx={x} cy={y} r="12" fill={c as string} opacity=".8" />)}
      </g>
      {/* Couch back, behind the two of them */}
      <path d="M150 470 Q160 430 220 428 L1380 428 Q1440 430 1450 470 L1450 900 L150 900 Z" fill={`url(#${id}-couch)`} />
      <path d="M800 440 V900" stroke="#1a2014" strokeWidth="6" opacity=".6" />
      <path d="M200 560 Q190 540 200 520 L280 520 L280 900 L200 900 Z" fill="#3c4a2e" />
      <path d="M1400 560 Q1410 540 1400 520 L1320 520 L1320 900 L1400 900 Z" fill="#3c4a2e" />
    </g>
  );
});

/** Coffee table clutter, out of focus, in front of everyone. */
const Foreground = memo(function Foreground({ id }: { id: string }) {
  return (
    <g filter={`url(#${id}-fg)`}>
      <defs><filter id={`${id}-fg`} x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="7" /></filter></defs>
      <rect x="240" y="840" width="1120" height="90" rx="14" fill="#2c1f18" />
      <rect x="320" y="800" width="190" height="56" rx="4" fill="#c9a06a" transform="rotate(-6 415 828)" />
      <rect x="980" y="780" width="34" height="72" rx="8" fill="#9be33b" />
      <rect x="1040" y="796" width="34" height="62" rx="8" fill="#c8cdd4" transform="rotate(70 1057 827)" />
      <rect x="1180" y="790" width="60" height="70" rx="10" fill="#ff5fa2" opacity=".8" />
    </g>
  );
});

const SEATS = { tanner: { x: 250, y: 20, s: 1.28 }, jade: { x: 830, y: 52, s: 1.2 } } as const;

/** The whole stream: one room, one couch, both of them, and a camera that drifts toward whoever is talking. */
export function CouchScene({ line, className = "" }: { line: ShowLine | null; className?: string }) {
  const id = useId().replace(/:/g, "");
  const t = useClock();
  const cam = useRef({ x: 800, z: 1 });
  const live = line && Date.now() - line.startedAt < line.durationMs + 400 ? line : null;
  const tannerLine = live?.characterId === "tanner" ? live : null;
  const jadeLine = live?.characterId === "jade" ? live : null;

  // The operator nudges toward the speaker and pushes in when someone in chat gets answered.
  const focusX = tannerLine ? 560 : jadeLine ? 1060 : 800;
  const zoom = live ? (live.kind === "answer" ? 1.14 : 1.06) : 1;
  cam.current.x += (focusX - cam.current.x) * 0.03;
  cam.current.z += (zoom - cam.current.z) * 0.03;
  const z = cam.current.z + 0.02; // a little overscan so the shake never shows an edge
  const half = 800 / z;
  const x = Math.min(1600 - half, Math.max(half, cam.current.x));
  const shakeX = Math.sin(t * 0.7) * 4 + Math.sin(t * 1.9) * 1.5;
  const shakeY = Math.sin(t * 0.9) * 3 + Math.sin(t * 2.3) * 1;
  const tv = 0.05 + 0.04 * Math.sin(t * 7.3) * Math.sin(t * 1.1);

  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <g transform={`translate(${800 + shakeX} ${450 + shakeY}) scale(${z}) translate(${-x} -450)`}>
        <g>
          <Room id={id} />
          <g transform={`translate(${SEATS.tanner.x} ${SEATS.tanner.y}) scale(${SEATS.tanner.s})`}>
            <Tanner t={t} line={tannerLine} partnerLine={jadeLine} side={1} />
          </g>
          <g transform={`translate(${SEATS.jade.x} ${SEATS.jade.y}) scale(${SEATS.jade.s})`}>
            <Jade t={t} line={jadeLine} partnerLine={tannerLine} side={-1} />
          </g>
          <Foreground id={id} />
        </g>
      </g>
      {/* TV light from the front, flickering */}
      <rect width="1600" height="900" fill="#6f9bff" opacity={tv} />
      <rect width="1600" height="900" fill="#ff3fa4" opacity=".04" />
    </svg>
  );
}
