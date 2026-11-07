"use client";
import { motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { visemeAt } from "@/lib/shared/visemes";
import type { Emotion, ShowLine, Viseme } from "@/lib/shared/types";
import { Brows, Eyes, Mouth } from "./parts";

const pivot = (x: string, y: string) => ({ transformBox: "fill-box" as const, transformOrigin: `${x} ${y}` });

function useBlink() {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => { setBlink(true); t = setTimeout(() => { setBlink(false); loop(); }, 130); }, 1800 + Math.random() * 3800);
    };
    loop();
    return () => clearTimeout(t);
  }, []);
  return blink;
}

/** Drives the mouth from the line's viseme timeline, using server time so late joiners stay in sync. */
function useViseme(line: ShowLine | null | undefined) {
  const [v, setV] = useState<Viseme>("X");
  useEffect(() => {
    if (!line) { setV("X"); return; }
    let raf = 0;
    const step = () => {
      setV(visemeAt(line.visemes, Date.now() - line.startedAt));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [line]);
  return v;
}

type FaceProps = { viseme: Viseme; emotion: Emotion; speaking: boolean; blink: boolean; look: number };
type BodyAnim = { speaking: boolean; emotion: Emotion };

function ArmSwing({ speaking, emotion, children, x, y, range = 8, angry = 18 }: BodyAnim & { children: ReactNode; x: string; y: string; range?: number; angry?: number }) {
  const amp = speaking ? (emotion === "angry" || emotion === "shocked" ? angry : range) : 2;
  return (
    <motion.g style={pivot(x, y)} animate={{ rotate: [0, -amp, 0, amp * 0.6, 0] }} transition={{ repeat: Infinity, duration: speaking ? 1.2 : 4.5, ease: "easeInOut" }}>
      {children}
    </motion.g>
  );
}

// Flat style: each character is one bold silhouette with noodle limbs and no outlines.
const limb = (color: string, width = 13) => ({ stroke: color, strokeWidth: width, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" });

function Face({ speaking, emotion, children, sway = 2 }: BodyAnim & { children: ReactNode; sway?: number }) {
  return (
    <motion.g
      style={pivot("50%", "100%")}
      animate={speaking ? { rotate: [-sway, sway, -sway], y: emotion === "shocked" ? [-5, -9, -5] : [0, -3, 0] } : { rotate: [0, sway * 0.3, 0], y: 0 }}
      transition={{ repeat: Infinity, duration: speaking ? 0.8 : 5, ease: "easeInOut" }}
    >
      {children}
    </motion.g>
  );
}

/** Dale: a tall capsule of hi-vis jacket, all mustache. */
function Dale({ viseme, emotion, speaking, blink, look }: FaceProps) {
  const skin = "#e8b48c";
  return (
    <>
      <path d="M78 292 V308 M122 292 V308" {...limb("#28324d", 12)} />
      <path d="M62 312 H84 M116 312 H138" {...limb("#3a2a1d", 11)} />
      <path d="M52 200 Q26 214 26 246" {...limb("#e86a10")} />
      <circle cx="26" cy="250" r="9" fill={skin} />
      <rect x="50" y="24" width="100" height="280" rx="48" fill="#ff7a1a" />
      <path d="M50 178 V72 A48 48 0 0 1 98 24 H102 A48 48 0 0 1 150 72 V178 Z" fill={skin} />
      <rect x="50" y="212" width="100" height="13" fill="#f6f2c2" />
      <rect x="50" y="240" width="100" height="13" fill="#f6f2c2" />
      <rect x="97" y="178" width="6" height="126" fill="#c95a0c" />
      <ArmSwing speaking={speaking} emotion={emotion} x="0%" y="100%" range={14} angry={28}>
        <path d="M148 200 Q176 188 176 150" {...limb("#e86a10")} />
        <circle cx="176" cy="146" r="9" fill={skin} />
        <rect x="168" y="112" width="17" height="30" rx="4" fill="#23262f" />
        <path d="M180 112 V92" stroke="#23262f" strokeWidth={3} strokeLinecap="round" />
        <circle cx="176" cy="122" r="3" fill="#ff5c6c" />
      </ArmSwing>
      <Face speaking={speaking} emotion={emotion} sway={1.5}>
        <path d="M50 80 V72 A48 48 0 0 1 98 24 H102 A48 48 0 0 1 150 72 V80 Z" fill="#23304d" />
        <path d="M46 78 H168 Q174 92 160 92 H46 Z" fill="#161f36" />
        <path d="M84 64 L95 46 L103 57 L110 48 L118 64 Z" fill="#ff7a1a" />
        <Eyes lx={80} rx={120} y={112} r={15} pupil={5} blink={blink} look={look} skin={skin} emotion={emotion} />
        <Brows lx={80} rx={120} y={96} w={13} emotion={emotion} color="#77726b" thick={7} />
        <Mouth cx={100} cy={160} w={24} viseme={viseme} emotion={emotion} speaking={speaking} />
        <path d="M100 130 Q70 122 34 146 Q62 164 100 146 Q138 164 166 146 Q130 122 100 130 Z" fill="#8f8a83" />
      </Face>
    </>
  );
}

/** Ronda: a sharp black wedge under a violet slab of hair. */
function Ronda({ viseme, emotion, speaking, blink, look }: FaceProps) {
  const skin = "#f0cbb0";
  return (
    <>
      <path d="M90 280 V306 M110 280 V306" {...limb(skin, 7)} />
      <path d="M84 311 H94 M106 311 H118" {...limb("#b02a4a", 8)} />
      <path d="M50 150 Q26 180 40 214" {...limb("#1b1c28", 11)} />
      <circle cx="42" cy="218" r="8" fill={skin} />
      <path d="M46 134 H154 Q160 134 158 142 L112 284 Q100 292 88 284 L42 142 Q40 134 46 134 Z" fill="#1b1c28" />
      <path d="M74 176 H126 L110 232 H90 Z" fill="#8a6440" />
      <ArmSwing speaking={speaking} emotion={emotion} x="0%" y="100%" range={7} angry={14}>
        <path d="M150 150 Q178 158 176 124" {...limb("#1b1c28", 11)} />
        <circle cx="176" cy="120" r="8" fill={skin} />
        <path d="M164 96 H190 L186 124 H168 Z" fill="#cfe3f2" opacity={0.7} />
        <path d="M166 110 H188 L186 124 H168 Z" fill="#d07f2c" />
      </ArmSwing>
      <Face speaking={speaking} emotion={emotion} sway={1.2}>
        <ellipse cx="100" cy="84" rx="38" ry="54" fill={skin} />
        <path d="M58 76 Q50 6 150 8 Q168 10 158 42 Q124 30 104 50 Q84 68 58 76 Z" fill="#7a54d8" />
        <Eyes lx={84} rx={118} y={84} r={11} pupil={4} blink={blink} look={look} lid={0.42} skin={skin} emotion={emotion} />
        <Brows lx={84} rx={118} y={68} w={10} emotion={emotion} thick={4} />
        <Mouth cx={100} cy={116} w={20} viseme={viseme} emotion={emotion === "neutral" ? "smug" : emotion} speaking={speaking} lip="#b02a4a" />
        <circle cx="62" cy="104" r="6" fill="none" stroke="#ffb35c" strokeWidth={3} />
      </Face>
    </>
  );
}

/** Yolanda: a huge round parka with a face on top and one arm always flexing. */
function Yolanda({ viseme, emotion, speaking, blink, look }: FaceProps) {
  const skin = "#8d5a3c";
  return (
    <>
      <path d="M66 288 V306 M134 288 V306" {...limb("#22304a", 18)} />
      <path d="M50 312 H78 M122 312 H150" {...limb("#14100c", 12)} />
      <path d="M186 214 Q206 240 192 266" {...limb("#167f7f", 22)} />
      <circle cx="190" cy="272" r="14" fill={skin} />
      <circle cx="100" cy="206" r="96" fill="#1f9c9c" />
      <rect x="4" y="214" width="192" height="14" fill="#ffd34d" opacity={0.95} />
      <rect x="112" y="178" width="46" height="26" rx="4" fill="#ffd34d" />
      <path d="M118 196 H146 L152 186 V198 H118 Z" fill="#14121a" />
      <ArmSwing speaking={speaking} emotion={emotion} x="100%" y="100%" range={12} angry={24}>
        <path d="M18 176 Q-8 150 8 112" {...limb("#167f7f", 22)} />
        <circle cx="10" cy="100" r="16" fill={skin} />
      </ArmSwing>
      <Face speaking={speaking} emotion={emotion} sway={3}>
        <circle cx="56" cy="62" r="32" fill="#1d1416" /><circle cx="100" cy="44" r="36" fill="#1d1416" /><circle cx="144" cy="62" r="32" fill="#1d1416" />
        <ellipse cx="100" cy="112" rx="64" ry="62" fill={skin} />
        <circle cx="38" cy="130" r="9" fill="none" stroke="#ffd34d" strokeWidth={4} />
        <circle cx="162" cy="130" r="9" fill="none" stroke="#ffd34d" strokeWidth={4} />
        <Eyes lx={78} rx={122} y={98} r={15} pupil={5.5} blink={blink} look={look} skin={skin} emotion={emotion} />
        <Brows lx={78} rx={122} y={78} w={14} emotion={emotion} thick={8} />
        <Mouth cx={100} cy={140} w={38} viseme={viseme} emotion={emotion === "neutral" ? "happy" : emotion} speaking={speaking} lip="#c23b4e" />
      </Face>
    </>
  );
}

/** Mort: a grey bean with a bandit mask, a vest and no hope. */
function Mort({ viseme, emotion, speaking, blink, look }: FaceProps) {
  const fur = "#8c919e";
  return (
    <>
      <motion.g style={pivot("100%", "100%")} animate={{ rotate: speaking ? [-7, 11, -7] : [-3, 5, -3] }} transition={{ repeat: Infinity, duration: speaking ? 1.1 : 3 }}>
        <path d="M46 278 Q2 276 12 208" {...limb(fur, 26)} />
        <path d="M6 236 L30 240 M12 262 L34 254" stroke="#23252e" strokeWidth={10} />
      </motion.g>
      <path d="M80 296 V308 M120 296 V308" {...limb(fur, 13)} />
      <path d="M68 312 H86 M114 312 H132" {...limb("#23252e", 10)} />
      <path d="M38 40 L30 2 L72 26 Z M162 40 L170 2 L128 26 Z" fill={fur} />
      <path d="M42 28 L38 12 L58 24 Z M158 28 L162 12 L142 24 Z" fill="#23252e" />
      <path d="M100 16 Q168 16 168 110 V214 Q168 300 100 300 Q32 300 32 214 V110 Q32 16 100 16 Z" fill={fur} />
      <path d="M52 202 Q100 180 148 202 Q168 214 168 232 Q164 300 100 300 Q36 300 32 232 Q32 214 52 202 Z" fill="#2d3147" />
      <path d="M100 196 V300" stroke="#1d2033" strokeWidth={4} />
      <circle cx="110" cy="232" r="3.5" fill="#ffd34d" /><circle cx="110" cy="258" r="3.5" fill="#ffd34d" />
      <rect x="58" y="226" width="28" height="22" fill="#f2e9c9" transform="rotate(-7 72 237)" />
      <ArmSwing speaking={speaking} emotion={emotion} x="0%" y="0%" range={7} angry={12}>
        <path d="M164 206 Q190 216 186 248" {...limb(fur)} />
        <circle cx="186" cy="260" r="14" fill="#e6c76b" />
        <circle cx="186" cy="260" r="9" fill="#fbf9f4" />
        <path d="M186 260 V254 M186 260 L190 262" stroke="#14121a" strokeWidth={2} />
      </ArmSwing>
      <Face speaking={speaking} emotion={emotion} sway={0.8}>
        <ellipse cx="100" cy="136" rx="46" ry="38" fill="#dcdde3" />
        <path d="M32 92 Q64 66 98 86 Q100 88 102 86 Q136 66 168 92 V108 Q136 126 106 108 Q100 104 94 108 Q64 126 32 108 Z" fill="#23252e" />
        <Eyes lx={68} rx={132} y={96} r={14} pupil={3.5} blink={blink} look={look} lid={0.55} skin="#23252e" emotion={emotion} />
        <ellipse cx="100" cy="124" rx="11" ry="8" fill="#14121a" />
        <Mouth cx={100} cy={150} w={20} viseme={viseme} emotion={emotion} speaking={speaking} />
      </Face>
    </>
  );
}

const RIGS: Record<string, (p: FaceProps) => ReactNode> = { dale: Dale, ronda: Ronda, yolanda: Yolanda, mort: Mort };

/** Rig lookup is by id so a licensed roster can register its own rigs without touching the stage. */
export function Rig({ rig, line, restEmotion = "neutral", look = 0, className }: { rig: string; line?: ShowLine | null; restEmotion?: Emotion; look?: number; className?: string }) {
  const blink = useBlink();
  const viseme = useViseme(line);
  const speaking = Boolean(line);
  const Body = RIGS[rig] ?? Mort;
  const emotion = line?.emotion ?? restEmotion;
  return (
    <svg viewBox="-14 0 228 322" className={className} role="img" aria-label={`${rig} character`}>
      <ellipse cx="100" cy="316" rx="72" ry="7" fill="rgba(5,6,14,.4)" />
      <motion.g style={pivot("50%", "100%")} animate={{ scaleY: speaking ? [1, 1.012, 1] : [1, 1.008, 1] }} transition={{ repeat: Infinity, duration: speaking ? 0.6 : 3.2, ease: "easeInOut" }}>
        <Body viseme={viseme} emotion={emotion} speaking={speaking} blink={blink} look={look} />
      </motion.g>
    </svg>
  );
}
