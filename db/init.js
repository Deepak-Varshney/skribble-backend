import { dbQuery, hasDatabase } from "./client.js";

export async function initDatabase() {
  if (!hasDatabase()) {
    console.log("DB: DATABASE_URL not set, running with in-memory game state only.");
    return;
  }

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
