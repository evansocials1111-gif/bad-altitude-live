import { readdir, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "./config";
import { log } from "./log";

export type Row = Record<string, any>;
export type Db = {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  driver: "postgres" | "pglite";
};

const store = globalThis as unknown as { __db?: Promise<Db> };

async function openPglite(dataDir: string | null): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir) await mkdir(path.dirname(dataDir), { recursive: true });
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;
  return {
    driver: "pglite",
    query: async (sql, params = []) => (await pg.query(sql, params as any[])).rows as any[],
    exec: async (sql) => { await pg.exec(sql); },
  };
}

async function openPostgres(url: string): Promise<Db> {
  const { Pool } = (await import("pg")).default;
  const pool = new Pool({
    connectionString: url,
    max: 8,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
  });
  pool.on("error", (e) => log("error", "db.pool_error", { message: e.message }));
  return {
    driver: "postgres",
    query: async (sql, params = []) => (await pool.query(sql, params as any[])).rows,
    exec: async (sql) => { await pool.query(sql); },
  };
}

export async function runMigrations(db: Db) {
  await db.exec(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set((await db.query(`select name from schema_migrations`)).map((r) => r.name));
  for (const file of files) {
    if (done.has(file)) continue;
    await db.exec(await readFile(path.join(dir, file), "utf8"));
    await db.query(`insert into schema_migrations (name) values ($1)`, [file]);
    log("info", "db.migrated", { file });
  }
}

export function getDb(): Promise<Db> {
  if (!store.__db) {
    store.__db = (async () => {
      const db = config.databaseUrl
        ? await openPostgres(config.databaseUrl)
        : await openPglite(config.pglitePath === ":memory:" ? null : config.pglitePath);
      await runMigrations(db);
      if (config.mock) {
        const { seedDemoData } = await import("./demo");
        await seedDemoData(db);
      }
      return db;
    })().catch((e) => { store.__db = undefined; throw e; });
  }
  return store.__db;
}

export async function q<T extends Row = Row>(sql: string, params: unknown[] = []) {
  return (await getDb()).query<T>(sql, params);
}

export async function q1<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
  return (await q<T>(sql, params))[0] ?? null;
}

/** Test helper: swap in a fresh in-memory database. */
export function resetDbForTests() {
  store.__db = undefined;
}
