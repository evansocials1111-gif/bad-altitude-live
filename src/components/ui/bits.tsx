"use client";
import { TIER_LABEL } from "@/lib/shared/format";

export function TierBadge({ tier, size = "sm" }: { tier: string; size?: "sm" | "xs" }) {
  return (
    <span className={`tier-${tier} tier-chip inline-flex items-center gap-1 rounded-full font-bold ${size === "xs" ? "px-1.5 py-0 text-[10px]" : "px-2.5 py-0.5 text-xs"}`}>
      {TIER_LABEL[tier] ?? tier}
    </span>
  );
}

/** Three small bars that fill with tier rank. A quiet signal beside a username. */
export function PriorityBars({ tier }: { tier: string }) {
  const level = { visitor: 0, supporter: 1, investor: 2, vip: 3, whale: 4 }[tier] ?? 0;
  return (
    <span className={`tier-${tier} inline-flex items-end gap-[2px]`} title={`${TIER_LABEL[tier]} priority`} aria-label={`${TIER_LABEL[tier]} priority`}>
      {[1, 2, 3, 4].map((n) => <span key={n} style={{ height: 3 + n * 2, background: n <= level ? "var(--tier)" : "rgba(255,255,255,.14)" }} className="w-[3px] rounded-sm" />)}
    </span>
  );
}

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

export function Avatar({ seed, size = 32 }: { seed: string; size?: number }) {
  const h = hash(seed || "x");
  const hue = h % 360;
  const eye = 18 + (h >> 4) % 6;
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" className="shrink-0 rounded-full" aria-hidden>
      <rect width="60" height="60" fill={`hsl(${hue} 45% 28%)`} />
      <path d={`M0 ${40 + (h >> 7) % 8} L${15 + (h >> 3) % 15} ${22 + (h >> 5) % 8} L${40 + (h >> 6) % 10} 44 L60 ${28 + (h >> 2) % 8} V60 H0 Z`} fill={`hsl(${(hue + 40) % 360} 40% 42%)`} />
      <circle cx={30 - eye / 2} cy="24" r="4" fill="#f2f5fa" /><circle cx={30 + eye / 2} cy="24" r="4" fill="#f2f5fa" />
      <circle cx={30 - eye / 2} cy="24" r="1.7" fill="#14121a" /><circle cx={30 + eye / 2} cy="24" r="1.7" fill="#14121a" />
    </svg>
  );
}

export function Unavailable({ reason }: { reason?: string }) {
  return <span className="text-sm font-semibold text-mist" title={reason}>Unavailable</span>;
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="rise mb-8">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h1 className="display text-4xl sm:text-6xl">{title}</h1>
      {children && <p className="mt-4 max-w-2xl text-frost">{children}</p>}
    </header>
  );
}

export function SimulatedBanner({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 rounded-xl border border-violet/40 bg-violet/10 px-4 py-2.5 text-sm text-frost"><strong className="text-snow">Simulated. </strong>{children}</div>;
}
