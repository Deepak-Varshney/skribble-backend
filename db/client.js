import { Pool } from "pg";

let pool = null;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!hasDatabase()) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }

  return pool;
}

export async function dbQuery(sql, params = []) {
  const p = getPool();
  return p.query(sql, params);
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
