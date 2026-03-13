import { dbQuery, hasDatabase } from "./client.js";

export async function initDatabase() {
  if (!hasDatabase()) {
    console.log("DB: DATABASE_URL not set, running with in-memory game state only.");
    return;
  }

  // Track every room that is created, its settings and lifecycle phase.
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS rooms (
      id          VARCHAR(12) PRIMARY KEY,
      host_name   VARCHAR(64),
      phase       VARCHAR(20) NOT NULL DEFAULT 'lobby',
      settings    JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at    TIMESTAMPTZ
    )
  `);

  await dbQuery(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT TRUE`);
  await dbQuery(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);
  await dbQuery(`UPDATE rooms SET expires_at = created_at + INTERVAL '1 hour' WHERE expires_at IS NULL`);
  await dbQuery(`CREATE INDEX IF NOT EXISTS idx_rooms_visibility_expiry ON rooms (is_private, expires_at, ended_at)`);

  // Track every player session inside a room.
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS room_players (
      room_id     VARCHAR(12) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      socket_id   VARCHAR(128) NOT NULL,
      player_name VARCHAR(64) NOT NULL,
      joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      left_at     TIMESTAMPTZ,
      PRIMARY KEY (room_id, socket_id)
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS game_results (
      id SERIAL PRIMARY KEY,
      room_id VARCHAR(12) NOT NULL,
      winner_name VARCHAR(64),
      winner_score INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS game_result_players (
      id SERIAL PRIMARY KEY,
      game_result_id INT NOT NULL REFERENCES game_results(id) ON DELETE CASCADE,
      player_name VARCHAR(64) NOT NULL,
      score INT NOT NULL
    )
  `);

  console.log("DB: PostgreSQL ready.");
}
