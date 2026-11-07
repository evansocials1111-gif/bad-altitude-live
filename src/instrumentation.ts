export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertProductionConfig } = await import("./lib/server/config");
  assertProductionConfig();
  const { startDirector } = await import("./lib/server/show/director");
  startDirector();
}
