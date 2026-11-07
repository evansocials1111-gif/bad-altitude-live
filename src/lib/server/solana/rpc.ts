import { config } from "../config";

export class RpcError extends Error {}

export async function rpc<T = any>(method: string, params: unknown[], url = config.solanaRpcUrl): Promise<T> {
  const send = () => fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  let res = await send();
  if (res.status === 429) {
    // Public endpoints throttle hard. One polite retry, then let the caller report it.
    await new Promise((r) => setTimeout(r, 1200));
    res = await send();
  }
  if (!res.ok) throw new RpcError(`RPC ${method} returned HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new RpcError(`RPC ${method}: ${json.error.message}`);
  return json.result as T;
}
