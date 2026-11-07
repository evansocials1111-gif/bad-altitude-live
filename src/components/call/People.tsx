"use client";
import { useId } from "react";
import type { Emotion, ShowLine } from "@/lib/shared/types";
import { Brow, Eye, Mouth } from "./features";
import { headMotion, useBlink, useClock, useExpression, useGaze, useMouth } from "./live";

export type PersonProps = {
  line: ShowLine | null; // the line this person is saying, if any
  emotion: Emotion;
  toward: number; // -1 or 1: which side of the screen the other caller is on
  listening: boolean; // the other caller is talking
  className?: string;
};

function usePerson({ line, emotion, toward, listening }: PersonProps) {
  const id = useId().replace(/:/g, "");
  const t = useClock();
  const speaking = !!line;
  const expr = useExpression(emotion);
  const open = useBlink(t) * expr.open;
  const gaze = useGaze(t, toward, speaking);
  const mouth = useMouth(t, line);
  const m = headMotion(t, speaking, expr, toward, listening);
  return { id, t, speaking, expr, open, gaze, mouth, m };
}

// Clothing and hair are drawn with gradients, not filters, so the faces stay smooth at 30 fps.

/** Doug: sunburned ski instructor, goggle tan, a jaw you could land a plane on. */
export function Doug(props: PersonProps) {
  const { id, t, expr, open, gaze, mouth, m } = usePerson(props);
  const skin = "#dc8a68", shade = "#9c4f3a", hi = "#f3b294";
  const f = m.yaw * 5; // features move further than the skull: cheap 3D
  return (
    <svg viewBox="0 0 400 480" preserveAspectRatio="xMidYMid slice" className={props.className} aria-hidden>
      <defs>
        <radialGradient id={`${id}-lamp`} cx="12%" cy="18%" r="55%"><stop offset="0" stopColor="#ffb766" stopOpacity=".55" /><stop offset="1" stopColor="#ffb766" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-neon`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ff4fa3" stopOpacity=".55" /><stop offset="1" stopColor="#ff4fa3" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-skin`} cx="44%" cy="38%" r="65%"><stop offset="0" stopColor={hi} /><stop offset=".55" stopColor={skin} /><stop offset="1" stopColor={shade} /></radialGradient>
        <radialGradient id={`${id}-tan`} cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#f6d2b8" /><stop offset=".72" stopColor="#f2c6a7" stopOpacity=".9" /><stop offset="1" stopColor="#f2c6a7" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-cheek`}><stop offset="0" stopColor="#d4503c" stopOpacity=".45" /><stop offset="1" stopColor="#d4503c" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${id}-jaw`} x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stopColor="#5a3423" stopOpacity="0" /><stop offset="1" stopColor="#5a3423" stopOpacity=".38" /></linearGradient>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f2d48e" /><stop offset=".5" stopColor="#c89a4c" /><stop offset="1" stopColor="#8a6430" /></linearGradient>
        <linearGradient id={`${id}-jacket`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c8323a" /><stop offset="1" stopColor="#6e1419" /></linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2b1208" stopOpacity=".35" /><stop offset=".3" stopColor="#2b1208" stopOpacity="0" /><stop offset=".75" stopColor="#2b1208" stopOpacity="0" /><stop offset="1" stopColor="#2b1208" stopOpacity=".4" /></linearGradient>
        <clipPath id={`${id}-head`}><path d="M200 92 C150 92 128 120 126 165 C124 200 118 230 112 262 C108 300 130 335 165 342 L235 342 C270 335 292 300 288 262 C282 230 276 200 274 165 C272 120 250 92 200 92 Z" /></clipPath>
      </defs>

      {/* Basement: wood panelling, string lights, a neon sign, his skis */}
      <rect width="400" height="480" fill="#24180f" />
      {Array.from({ length: 10 }, (_, i) => <rect key={i} x={i * 42} y="0" width="38" height="480" fill={i % 2 ? "#33231a" : "#2c1e15"} />)}
      <rect width="400" height="480" fill={`url(#${id}-lamp)`} />
      <g opacity=".85">
        <rect x="18" y="40" width="16" height="400" rx="8" fill="#e8e3da" transform="rotate(-8 26 240)" />
        <rect x="40" y="44" width="16" height="400" rx="8" fill="#d23a3a" transform="rotate(-6 48 240)" />
      </g>
      <circle cx="335" cy="100" r="70" fill={`url(#${id}-neon)`} opacity={0.75 + Math.sin(t * 17) * Math.sin(t * 2.3) * 0.12} />
      <rect x="300" y="82" width="72" height="34" rx="10" fill="none" stroke="#ff7cc0" strokeWidth="4" opacity=".8" />
      {Array.from({ length: 9 }, (_, i) => <circle key={i} cx={30 + i * 44} cy={28 + Math.sin(i * 1.3) * 8} r="4" fill="#ffd27a" opacity={0.6 + 0.3 * Math.sin(t * 1.5 + i)} />)}
      {/* Soft focus on the background, like a real webcam */}
      <rect width="400" height="480" fill="#1a110b" opacity=".35" />

      {/* Body breathes */}
      <g transform={`translate(${m.x * 0.35} ${m.breathe * 1.2})`}>
        <path d="M160 300 L240 300 L246 380 L154 380 Z" fill={shade} />
        <path d="M168 332 Q200 352 232 332 L236 372 L164 372 Z" fill="#6b3524" opacity=".5" />
        <path d="M28 480 C40 400 104 372 158 364 Q200 392 242 364 C296 372 360 400 372 480 Z" fill={`url(#${id}-jacket)`} />
        <path d="M150 366 Q200 410 250 366 L258 384 Q200 430 142 384 Z" fill="#1d1d22" />
        <path d="M200 400 V480" stroke="#111" strokeWidth="3" />
        <rect x="262" y="410" width="34" height="20" rx="4" fill="#f4f1ea" opacity=".85" />
      </g>

      {/* Head */}
      <g transform={`translate(${m.x} ${m.y}) rotate(${m.rot} 200 340)`}>
        <ellipse cx={118 - f * 0.4} cy="210" rx="14" ry="26" fill={skin} />
        <ellipse cx={282 - f * 0.4} cy="210" rx="14" ry="26" fill={skin} />
        <ellipse cx={120 - f * 0.4} cy="210" rx="6" ry="15" fill={shade} opacity=".5" />
        <ellipse cx={280 - f * 0.4} cy="210" rx="6" ry="15" fill={shade} opacity=".5" />
        <path d="M200 92 C150 92 128 120 126 165 C124 200 118 230 112 262 C108 300 130 335 165 342 L235 342 C270 335 292 300 288 262 C282 230 276 200 274 165 C272 120 250 92 200 92 Z" fill={`url(#${id}-skin)`} />
        <g clipPath={`url(#${id}-head)`}>
          <rect x="100" y="90" width="200" height="260" fill={`url(#${id}-side)`} transform={`translate(${f * 0.8} 0)`} />
          <rect x="100" y="90" width="200" height="260" fill={`url(#${id}-jaw)`} />
          {/* Goggle tan and strap lines */}
          <rect x={124 + f} y="158" width="152" height="66" rx="30" fill={`url(#${id}-tan)`} />
          <rect x="100" y="182" width="40" height="14" fill="#f2c6a7" opacity=".5" />
          <rect x="262" y="182" width="40" height="14" fill="#f2c6a7" opacity=".5" />
          <ellipse cx={150 + f} cy="248" rx="26" ry="18" fill={`url(#${id}-cheek)`} />
          <ellipse cx={250 + f} cy="248" rx="26" ry="18" fill={`url(#${id}-cheek)`} />
          {/* Stubble */}
          <g fill="#5b3a22" opacity=".28" transform={`translate(${f} 0)`}>
            {Array.from({ length: 140 }, (_, i) => {
              const a = (i * 137.5) % 360 * (Math.PI / 180), r = 30 + ((i * 53) % 70);
              const x = 200 + Math.cos(a) * r * 1.25, y = 300 + Math.sin(a) * r * 0.55;
              return y > 268 ? <circle key={i} cx={x} cy={y} r=".9" /> : null;
            })}
          </g>
          <path d={`M${200 + f} 322 V336`} stroke={shade} strokeWidth="2" opacity=".55" />
        </g>

        {/* Features */}
        <g transform={`translate(${f} 0)`}>
          <Eye id={`${id}-el`} cx={166} cy={194} rx={15} ry={7.5} iris="#3f80c2" open={open} gaze={gaze} skinShadow={shade} side={-1} />
          <Eye id={`${id}-er`} cx={234} cy={194} rx={15} ry={7.5} iris="#3f80c2" open={open} gaze={gaze} skinShadow={shade} side={1} />
          <Brow cx={164} cy={175} len={40} thick={9} color="#7d5a2c" expr={expr} side={-1} extra={expr.asym * 6} />
          <Brow cx={236} cy={175} len={40} thick={9} color="#7d5a2c" expr={expr} side={1} />
          {/* Nose */}
          <path d="M193 200 Q190 232 184 246 M207 200 Q210 232 216 246" fill="none" stroke={shade} strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
          <path d="M199 198 Q201 222 200 238" stroke={hi} strokeWidth="4" strokeLinecap="round" opacity=".6" />
          <ellipse cx="200" cy="246" rx="17" ry="11" fill={skin} />
          <ellipse cx="198" cy="242" rx="7" ry="4" fill={hi} opacity=".75" />
          <ellipse cx="190" cy="252" rx="5" ry="3" fill="#4a2015" opacity=".75" />
          <ellipse cx="210" cy="252" rx="5" ry="3" fill="#4a2015" opacity=".75" />
          <path d="M176 262 Q170 272 172 282 M224 262 Q230 272 228 282" fill="none" stroke={shade} strokeOpacity=".3" strokeWidth="2" />
          <Mouth id={`${id}-m`} cx={200} cy={290} w={62} lip="#c06a5c" lipDark="#7d3b31" open={mouth.open} wide={mouth.wide} expr={expr} />
        </g>

        {/* Hair, swept and a bit wrecked */}
        <g transform={`translate(${f * 0.5} 0)`}>
          <path d="M122 172 C108 110 150 66 206 68 C266 66 296 112 280 172 C276 148 262 128 244 116 C228 134 196 130 176 118 C160 130 136 146 122 172 Z" fill={`url(#${id}-hair)`} />
          <path d="M150 92 C176 70 230 70 258 96 M140 120 C168 92 212 88 246 108 M170 82 C200 74 236 80 262 104" fill="none" stroke="#fbe7b4" strokeOpacity=".45" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M244 116 C252 126 262 140 268 158 M176 118 C170 132 156 144 146 152" fill="none" stroke="#7a5526" strokeOpacity=".5" strokeWidth="2" />
        </g>
      </g>

      {/* Laptop screen glow from the front */}
      <rect width="400" height="480" fill="#9cc6ff" opacity=".05" />
    </svg>
  );
}

// Positions for Marlene's curls, worked out once.
const CURLS = Array.from({ length: 30 }, (_, i) => {
  const a = Math.PI * (0.92 + (i / 29) * 1.16);
  const r = 118 + ((i * 37) % 3) * 9;
  return { x: 200 + Math.cos(a) * r * 0.98, y: 205 + Math.sin(a) * r * 0.95, r: 24 + ((i * 29) % 4) * 4, light: i % 3 !== 0 };
});
const FRINGE = Array.from({ length: 9 }, (_, i) => ({ x: 128 + i * 18, y: 100 + Math.abs(i - 4) * 5 + (i % 2) * 6, r: 19 + (i % 3) * 3 }));

/** Marlene: seventy-one, four foot ten, enormous glasses, holding the phone too close. */
export function Marlene(props: PersonProps) {
  const { id, t, expr, open, gaze, mouth, m } = usePerson(props);
  const skin = "#e6bea5", shade = "#a87a64", hi = "#f7dcc9";
  const f = m.yaw * 5;
  const lens = (cx: number) => (
    <g key={cx}>
      <circle cx={cx} cy="218" r="48" fill="#cfe4ff" opacity=".08" />
      <path d={`M${cx - 32} ${194} Q${cx - 18} ${178} ${cx + 4} ${178}`} stroke="#fff" strokeWidth="7" strokeLinecap="round" opacity=".28" fill="none" />
      <path d={`M${cx + 26} ${244} Q${cx + 34} ${236} ${cx + 36} ${224}`} stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".18" fill="none" />
      <circle cx={cx} cy="218" r="48" fill="none" stroke="#7a1f2b" strokeWidth="7" />
      <circle cx={cx} cy="218" r="44" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="2" />
    </g>
  );
  return (
    <svg viewBox="0 0 400 480" preserveAspectRatio="xMidYMid slice" className={props.className} aria-hidden>
      <defs>
        <pattern id={`${id}-paper`} width="64" height="64" patternUnits="userSpaceOnUse">
          <rect width="64" height="64" fill="#c8b495" />
          <circle cx="16" cy="16" r="9" fill="#b07a78" opacity=".55" /><circle cx="48" cy="48" r="9" fill="#b07a78" opacity=".55" />
          <circle cx="24" cy="20" r="5" fill="#7d8f62" opacity=".45" /><circle cx="56" cy="52" r="5" fill="#7d8f62" opacity=".45" />
        </pattern>
        <radialGradient id={`${id}-lamp`} cx="88%" cy="22%" r="60%"><stop offset="0" stopColor="#ffd08a" stopOpacity=".7" /><stop offset="1" stopColor="#ffd08a" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-skin`} cx="52%" cy="40%" r="62%"><stop offset="0" stopColor={hi} /><stop offset=".6" stopColor={skin} /><stop offset="1" stopColor={shade} /></radialGradient>
        <radialGradient id={`${id}-rouge`}><stop offset="0" stopColor="#e0707a" stopOpacity=".42" /><stop offset="1" stopColor="#e0707a" stopOpacity="0" /></radialGradient>
        <radialGradient id={`${id}-curl`} cx="40%" cy="35%" r="65%"><stop offset="0" stopColor="#fbfaf7" /><stop offset=".7" stopColor="#e2ddd5" /><stop offset="1" stopColor="#b5ada3" /></radialGradient>
        <radialGradient id={`${id}-curl2`} cx="40%" cy="35%" r="65%"><stop offset="0" stopColor="#ece8e1" /><stop offset=".7" stopColor="#cfc8bf" /><stop offset="1" stopColor="#9e958a" /></radialGradient>
        <linearGradient id={`${id}-cardi`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9a86b6" /><stop offset="1" stopColor="#56456e" /></linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#3b2216" stopOpacity=".35" /><stop offset=".28" stopColor="#3b2216" stopOpacity="0" /><stop offset=".8" stopColor="#3b2216" stopOpacity="0" /><stop offset="1" stopColor="#3b2216" stopOpacity=".3" /></linearGradient>
        <clipPath id={`${id}-head`}><path d="M200 84 C140 84 106 134 106 204 C106 272 130 338 168 374 C184 388 216 388 232 374 C270 338 294 272 294 204 C294 134 260 84 200 84 Z" /></clipPath>
      </defs>

      {/* Her living room: floral wallpaper, a lamp, a photo of a better grandson, and Judge the cat */}
      <rect width="400" height="480" fill={`url(#${id}-paper)`} />
      <rect width="400" height="480" fill="#2a1a10" opacity=".28" />
      <rect x="24" y="70" width="70" height="86" rx="4" fill="#3d2a1a" /><rect x="32" y="78" width="54" height="70" fill="#7c8a96" opacity=".7" />
      <rect width="400" height="480" fill={`url(#${id}-lamp)`} />
      <g transform={`translate(${Math.sin(t * 0.3) * 2} 0)`}>
        <ellipse cx="342" cy="372" rx="54" ry="34" fill="#c9732e" />
        <circle cx="330" cy="336" r="26" fill="#c9732e" />
        <path d="M312 322 L316 300 L326 316 M334 314 L344 296 L348 320" fill="#c9732e" />
        <ellipse cx={322 + Math.sin(t * 0.7)} cy="334" rx="4" ry={Math.sin(t * 0.21) > 0.97 ? 0.5 : 3} fill="#2a2a10" />
        <ellipse cx={340 + Math.sin(t * 0.7)} cy="334" rx="4" ry={Math.sin(t * 0.21) > 0.97 ? 0.5 : 3} fill="#2a2a10" />
      </g>
      <rect width="400" height="480" fill="#f0e2c8" opacity=".12" />

      {/* Back of her hair */}
      <g transform={`translate(${m.x * 0.9} ${m.y}) rotate(${m.rot} 200 380)`}>
        {CURLS.map((c, i) => <circle key={i} cx={c.x} cy={c.y + 10} r={c.r} fill={`url(#${id}-curl2)`} />)}
      </g>

      {/* Cardigan, blouse, pearls */}
      <g transform={`translate(${m.x * 0.35} ${m.breathe * 1.1})`}>
        <path d="M172 330 L228 330 L232 400 L168 400 Z" fill={shade} />
        <path d="M14 480 C34 428 108 402 152 392 Q200 418 248 392 C292 402 366 428 386 480 Z" fill={`url(#${id}-cardi)`} />
        <path d="M152 392 L176 440 L200 410 L224 440 L248 392 Q200 420 152 392 Z" fill="#f4efe6" />
        {Array.from({ length: 13 }, (_, i) => {
          const a = Math.PI * (0.15 + (i / 12) * 0.7);
          return <circle key={i} cx={200 - Math.cos(a) * 46} cy={392 + Math.sin(a) * 22} r="4.2" fill="#f7f3ec" stroke="#cfc6b8" strokeWidth=".8" />;
        })}
      </g>

      {/* Head */}
      <g transform={`translate(${m.x} ${m.y}) rotate(${m.rot} 200 380)`}>
        <ellipse cx={106 - f * 0.4} cy="228" rx="13" ry="24" fill={skin} />
        <ellipse cx={294 - f * 0.4} cy="228" rx="13" ry="24" fill={skin} />
        <circle cx={106 - f * 0.4} cy="256" r="6" fill="#f8f5ee" stroke="#cfc6b8" />
        <circle cx={294 - f * 0.4} cy="256" r="6" fill="#f8f5ee" stroke="#cfc6b8" />
        <path d="M200 84 C140 84 106 134 106 204 C106 272 130 338 168 374 C184 388 216 388 232 374 C270 338 294 272 294 204 C294 134 260 84 200 84 Z" fill={`url(#${id}-skin)`} />
        <g clipPath={`url(#${id}-head)`}>
          <rect x="100" y="80" width="200" height="320" fill={`url(#${id}-side)`} transform={`translate(${f * 0.8} 0)`} />
          <ellipse cx={146 + f} cy="292" rx="28" ry="20" fill={`url(#${id}-rouge)`} />
          <ellipse cx={254 + f} cy="292" rx="28" ry="20" fill={`url(#${id}-rouge)`} />
          {/* Lines she has earned */}
          <g fill="none" stroke={shade} strokeLinecap="round" transform={`translate(${f} 0)`}>
            <path d="M160 128 Q200 120 240 128 M166 140 Q200 133 234 140" strokeOpacity={0.22 + Math.max(0, expr.brow) * 0.03} strokeWidth="1.6" />
            <path d="M180 292 Q166 312 170 334 M220 292 Q234 312 230 334" strokeOpacity=".35" strokeWidth="2" />
            <path d="M172 346 Q170 356 176 364 M228 346 Q230 356 224 364" strokeOpacity=".25" strokeWidth="1.6" />
            <path d="M194 168 V180 M206 168 V180" strokeOpacity={0.15 + Math.max(0, expr.tilt) * 0.03} strokeWidth="1.6" />
          </g>
        </g>

        <g transform={`translate(${f} 0)`}>
          {/* Eyes, magnified by the lenses */}
          <Eye id={`${id}-el`} cx={152} cy={220} rx={13} ry={7} iris="#6f5a36" open={open} gaze={gaze} skinShadow={shade} scale={1.45} side={-1} />
          <Eye id={`${id}-er`} cx={248} cy={220} rx={13} ry={7} iris="#6f5a36" open={open} gaze={gaze} skinShadow={shade} scale={1.45} side={1} />
          <path d="M134 240 Q152 250 170 240 M230 240 Q248 250 266 240" fill="none" stroke={shade} strokeOpacity=".35" strokeWidth="1.6" />
          {/* Brows peek over the frames */}
          <Brow cx={150} cy={160} len={36} thick={5} color="#8e8378" expr={expr} side={-1} extra={expr.asym * 6} />
          <Brow cx={250} cy={160} len={36} thick={5} color="#8e8378" expr={expr} side={1} />
          {/* Nose */}
          <path d="M195 226 Q192 258 188 272 M205 226 Q208 258 212 272" fill="none" stroke={shade} strokeOpacity=".35" strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="200" cy="274" rx="12" ry="9" fill={skin} />
          <ellipse cx="199" cy="270" rx="5" ry="3" fill={hi} opacity=".8" />
          <ellipse cx="193" cy="280" rx="3.5" ry="2" fill="#5a3326" opacity=".7" />
          <ellipse cx="207" cy="280" rx="3.5" ry="2" fill="#5a3326" opacity=".7" />
          <Mouth id={`${id}-m`} cx={200} cy={318} w={50} lip="#b8394c" lipDark="#7a2030" open={mouth.open} wide={mouth.wide} expr={expr} />
          {/* The glasses */}
          {lens(150)}
          {lens(250)}
          <path d="M206 212 Q200 204 194 212" fill="none" stroke="#7a1f2b" strokeWidth="6" />
          <path d="M104 210 L112 214 M296 210 L288 214" stroke="#7a1f2b" strokeWidth="5" />
        </g>

        {/* Front curls */}
        <g transform={`translate(${f * 0.4} 0)`}>
          {FRINGE.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={`url(#${id}-curl)`} />)}
          {CURLS.filter((_, i) => i < 5 || i > 25).map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={c.r * 0.8} fill={`url(#${id}-curl)`} />)}
        </g>
      </g>

      <rect width="400" height="480" fill="#ffcf8a" opacity=".06" />
    </svg>
  );
}

export const PEOPLE: Record<string, (p: PersonProps) => React.ReactElement> = { doug: Doug, marlene: Marlene };
