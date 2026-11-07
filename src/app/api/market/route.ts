import { route } from "@/lib/server/http";
import { getMarket } from "@/lib/server/market";
import { showState } from "@/lib/server/show/bus";

export const GET = route(async () => ({ market: await getMarket(), viewers: showState.viewers }));
