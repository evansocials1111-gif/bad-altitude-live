"use client";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

/** Depth-sorted canvas snowfall: near flakes are bigger, faster and drift more with the wind. */
function Snow() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, w = 0, h = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = canvas.width = r.width; h = canvas.height = r.height;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const flakes = Array.from({ length: Math.min(170, Math.round(w / 8)) }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() ** 2, p: Math.random() * 6.28 }));
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(50, now - last) / 16.67;
      last = now;
      ctx.clearRect(0, 0, w, h);
      const wind = Math.sin(now / 5200) * 0.35 + 0.2;
      for (const f of flakes) {
        f.y += (0.0009 + f.z * 0.0032) * dt;
        f.x += ((wind + Math.sin(now / 900 + f.p) * 0.4) * (0.0004 + f.z * 0.0014)) * dt;
        if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); }
        if (f.x > 1.02) f.x = -0.02; if (f.x < -0.02) f.x = 1.02;
        ctx.globalAlpha = 0.28 + f.z * 0.65;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(f.x * w, f.y * h, 0.7 + f.z * 2.8, 0, 6.29);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-30 h-full w-full" aria-hidden />;
}

const pines = (xs: number[], base: number, size: number, fill: string) => xs.map((x, i) => {
  const s = size * (0.8 + ((i * 7) % 5) / 10);
  return <path key={x} d={`M${x} ${base - s * 2.6} L${x + s * .55} ${base - s * 1.7} L${x + s * .32} ${base - s * 1.7} L${x + s * .8} ${base - s * .8} L${x + s * .4} ${base - s * .8} L${x + s} ${base} H${x - s} L${x - s * .4} ${base - s * .8} L${x - s * .8} ${base - s * .8} L${x - s * .32} ${base - s * 1.7} L${x - s * .55} ${base - s * 1.7} Z`} fill={fill} />;
});

export function TownScene({ intensity = 1, glow = 0 }: { intensity?: number; glow?: number }) {
  const mx = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 40, damping: 18 });
  const far = useTransform(x, (v) => v * 8 * intensity);
  const mid = useTransform(x, (v) => v * 18 * intensity);
  const near = useTransform(x, (v) => v * 34 * intensity);

  useEffect(() => {
    const onMove = (e: PointerEvent) => mx.set((e.clientX / window.innerWidth - 0.5) * -1);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mx]);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#070914" /><stop offset=".45" stopColor="#171a3a" /><stop offset=".68" stopColor="#3c2f62" /><stop offset=".84" stopColor="#a4553f" /><stop offset="1" stopColor="#e88a3c" />
          </linearGradient>
          <linearGradient id="farMtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3f4f78" /><stop offset="1" stopColor="#262d4f" /></linearGradient>
          <linearGradient id="midMtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#222a4a" /><stop offset="1" stopColor="#141831" /></linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c9d6ec" /><stop offset=".45" stopColor="#8fa1c6" /><stop offset="1" stopColor="#39436b" /></linearGradient>
          <radialGradient id="windowGlow"><stop offset="0" stopColor="#ffb15a" stopOpacity=".55" /><stop offset="1" stopColor="#ffb15a" stopOpacity="0" /></radialGradient>
          <radialGradient id="neonGlow"><stop offset="0" stopColor="#ff5a9a" stopOpacity=".5" /><stop offset="1" stopColor="#ff5a9a" stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#sky)" />
        {[[120,70],[300,140],[480,50],[640,170],[820,90],[990,40],[1180,150],[1340,70],[1520,130],[220,220],[720,240],[1420,230]].map(([cx,cy],i) => <circle key={i} cx={cx} cy={cy} r={i % 3 ? 1.3 : 2} fill="#dfe8ff" opacity={.35 + (i % 4) * .15} />)}
        <circle cx="1260" cy="150" r="52" fill="#f3ead2" opacity=".92" /><circle cx="1242" cy="138" r="48" fill="#171a3a" opacity=".82" />

        <motion.g style={{ x: far }}>
          <path d="M-80 640 L170 300 L300 450 L470 220 L640 470 L800 330 L1000 520 L1190 250 L1370 470 L1500 350 L1700 610 V760 H-80 Z" fill="url(#farMtn)" />
          <path d="M170 300 L232 385 L196 370 L172 402 L140 372 L114 378 Z M470 220 L552 340 L505 318 L470 360 L432 322 L395 335 Z M1190 250 L1272 348 L1224 330 L1192 372 L1152 332 L1118 345 Z M800 330 L858 384 L820 374 L798 398 L772 374 L748 380 Z" fill="#e8eefb" />
        </motion.g>

        <motion.g style={{ x: mid }}>
          <path d="M-80 720 L120 520 L330 640 L560 470 L780 640 L1020 520 L1260 650 L1450 530 L1700 680 V860 H-80 Z" fill="url(#midMtn)" />
          {pines([40, 92, 150, 215, 280, 350, 430, 505, 590, 660, 725, 800, 880, 950, 1040, 1110, 1190, 1275, 1340, 1420, 1500, 1570], 690, 26, "#0d1228")}
          {/* chairlift rising up the ridge */}
          <path d="M1600 600 L1000 450" stroke="#0c0f20" strokeWidth="3" />
          {[1520, 1280, 1040].map((px, i) => <path key={px} d={`M${px} ${580 - i * 60} v110 M${px - 18} ${580 - i * 60} h36`} stroke="#0c0f20" strokeWidth="5" />)}
          <g className="lift-chairs">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const px = 1040 + i * 100; const py = 460 + i * 25; return <g key={i}><path d={`M${px} ${py} v26`} stroke="#0c0f20" strokeWidth="2.5" /><path d={`M${px - 12} ${py + 26} h24 v6 h-24 z`} fill="#ff7a1a" /></g>; })}
          </g>
        </motion.g>

        <motion.g style={{ x: near }}>
          {/* town row */}
          <g>
            <path d="M-60 760 V640 L40 590 L140 640 V760 Z" fill="#20243f" /><path d="M-70 646 L40 584 L150 646 L128 650 L40 604 L-48 650 Z" fill="#e8eefb" />
            <rect x="24" y="668" width="34" height="42" fill="#ffb15a" opacity=".85" /><path d="M41 668 v42 M24 688 h34" stroke="#20243f" strokeWidth="3" />
            {/* pawnshop */}
            <rect x="170" y="630" width="210" height="130" fill="#2a2740" /><rect x="160" y="620" width="230" height="16" fill="#e8eefb" rx="6" />
            <rect x="190" y="650" width="170" height="34" fill="#141628" /><text x="275" y="674" textAnchor="middle" fontFamily="var(--font-bowlby)" fontSize="20" fill="#ffd34d">MORT&apos;S PAWN</text>
            <rect x="200" y="698" width="62" height="60" fill="#ffb15a" opacity=".55" /><rect x="290" y="698" width="52" height="62" fill="#191b2e" />
            {/* The Liquidation: bar */}
            <rect x="620" y="570" width="400" height="190" fill="#231f33" /><path d="M600 574 L820 500 L1040 574 Z" fill="#191626" /><path d="M592 576 L820 490 L1048 576 L1020 582 L820 514 L620 582 Z" fill="#eef3fd" />
            <circle cx="820" cy="610" r="190" fill="url(#neonGlow)" className="neon-flicker" />
            <g className="neon-flicker">
              <rect x="668" y="592" width="304" height="52" rx="8" fill="#110e1b" stroke="#ff5a9a" strokeWidth="3" />
              <text x="820" y="628" textAnchor="middle" fontFamily="var(--font-bowlby)" fontSize="29" letterSpacing="2" fill="#ff8ab8">THE LIQUIDATION</text>
            </g>
            <circle cx="705" cy="700" r="90" fill="url(#windowGlow)" /><circle cx="935" cy="700" r="90" fill="url(#windowGlow)" />
            <rect x="650" y="664" width="106" height="68" rx="4" fill="#ffc47a" /><rect x="884" y="664" width="106" height="68" rx="4" fill="#ffc47a" />
            <path d="M703 664 v68 M937 664 v68" stroke="#231f33" strokeWidth="4" />
            <rect x="782" y="664" width="76" height="96" rx="3" fill="#3a2332" /><circle cx="846" cy="716" r="4" fill="#ffd34d" />
            {/* plow */}
            <g transform="translate(1190 660)">
              <rect x="30" y="20" width="150" height="62" rx="8" fill="#ffb629" stroke="#14121a" strokeWidth="4" /><rect x="110" y="-14" width="66" height="50" rx="6" fill="#ffc94f" stroke="#14121a" strokeWidth="4" /><rect x="122" y="-6" width="42" height="26" rx="3" fill="#2e3a5e" />
              <path d="M178 40 L232 20 L240 92 L180 82 Z" fill="#ff7a1a" stroke="#14121a" strokeWidth="4" />
              <circle cx="66" cy="88" r="18" fill="#14121a" /><circle cx="150" cy="88" r="18" fill="#14121a" /><circle cx="66" cy="88" r="7" fill="#8fa1c6" /><circle cx="150" cy="88" r="7" fill="#8fa1c6" />
              <path d="M136 -14 h24 v-8 h-24 z" fill="#ff5c6c" />
              <path d="M30 20 Q100 2 110 8" stroke="#eef3fd" strokeWidth="9" fill="none" strokeLinecap="round" />
            </g>
            {pines([470, 545, 1090, 1150, 1500, 1555], 762, 30, "#10152e")}
          </g>
          {/* street */}
          <path d="M-80 756 Q300 730 800 748 T1680 738 V920 H-80 Z" fill="url(#ground)" />
          <path d="M-80 828 Q500 790 1680 836 V920 H-80 Z" fill="#dfe7f6" opacity=".2" />
        </motion.g>
        <rect width="1600" height="900" fill="rgba(255,122,26,.09)" opacity={glow} />
      </svg>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,transparent_40%,rgba(6,7,14,.72)_100%)]" />
      <Snow />
    </div>
  );
}
