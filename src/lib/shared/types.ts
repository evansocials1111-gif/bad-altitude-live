export type Emotion = "neutral" | "happy" | "angry" | "shocked" | "smug" | "sad";
export type Viseme = "X" | "A" | "E" | "O" | "M";
export type VisemeCue = { t: number; v: Viseme };
export type TierName = "visitor" | "supporter" | "investor" | "vip" | "whale";
export type LineKind = "answer" | "banter" | "market" | "system";

export type OwnershipState =
  | "address_submitted"
  | "holdings_detected"
  | "ownership_verified"
  | "ownership_not_verified";

export type ShowLine = {
  id: string;
  characterId: string;
  characterName: string;
  text: string;
  emotion: Emotion;
  kind: LineKind;
  addressedTo?: string | null;
  question?: string | null;
  audioUrl?: string | null;
  visemes: VisemeCue[];
  durationMs: number;
  startedAt: number;
  llmProvider: string;
  ttsProvider: string;
};

export type ShowStatus = {
  live: boolean;
  mode: "off" | "idle" | "banter" | "answering" | "paused_no_viewers" | "budget_exhausted";
  viewers: number;
  note?: string;
};

export type MarketField<T = number> = { value: T | null; source: string | null };

export type MarketSnapshot = {
  status: "live" | "simulated" | "unavailable" | "no_mint";
  reason?: string;
  fetchedAt: number | null;
  mint: string | null;
  symbol: string | null;
  name: string | null;
  priceUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  liquidityUsd: number | null;
  priceChange: { m5: number | null; h1: number | null; h6: number | null; h24: number | null };
  txns24h: { buys: number; sells: number } | null;
  holders: number | null;
  holdersUnavailableReason?: string;
  pairUrl: string | null;
  recentTransactions: { signature: string; blockTime: number | null; ok: boolean }[];
};

export type StreamEvent =
  | { type: "line"; line: ShowLine }
  | { type: "status"; status: ShowStatus }
  | { type: "chat"; message: ChatItem }
  | { type: "chat_removed"; id: string }
  | { type: "queue"; queue: QueueItem[] }
  | { type: "presence"; viewers: number };

export type ChatItem = {
  id: string;
  username: string;
  avatarSeed: string;
  tier: TierName;
  content: string;
  createdAt: string;
};

export type QueueItem = {
  id: string;
  position: number | null;
  username: string;
  tier: TierName;
  characterId: string;
  content: string;
  status: string;
  createdAt: string;
  response?: string | null;
};
