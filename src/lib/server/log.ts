type Level = "info" | "warn" | "error";

export function log(level: Level, event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...data });
  if (process.env.NODE_ENV === "test") return;
  if (level === "error") console.error(line);
  else console.log(line);
}
