export function formatCompact(n: number | null | undefined, opts: { prefix?: string } = {}) {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  const prefix = opts.prefix ?? "";
  return prefix + new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

export function formatPrice(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  if (n >= 1) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return "$" + n.toPrecision(4).replace(/\.?0+$/, "");
}

export function maskAddress(a: string) {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export const TIER_LABEL: Record<string, string> = {
  visitor: "Visitor", supporter: "Supporter", investor: "Investor", vip: "VIP", whale: "Whale",
};
