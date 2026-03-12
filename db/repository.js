import { dbQuery, hasDatabase } from "./client.js";

export async function saveGameResult({ roomId, winner, leaderboard }) {
  if (!hasDatabase()) return;

  const winnerName = winner?.name ?? null;
  const winnerScore = Number.isFinite(winner?.score) ? winner.score : null;

  const result = await dbQuery(
    `INSERT INTO game_results (room_id, winner_name, winner_score)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [roomId, winnerName, winnerScore]
  );

  const gameResultId = result.rows[0].id;
  for (const p of leaderboard) {
    await dbQuery(
      `INSERT INTO game_result_players (game_result_id, player_name, score)
       VALUES ($1, $2, $3)`,
      [gameResultId, String(p.name ?? "Player").slice(0, 64), Number(p.score) || 0]
    );
  }
}

export async function getRecentGameResults(limit = 10) {
  if (!hasDatabase()) return [];

  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));
  const { rows } = await dbQuery(
    `SELECT id, room_id, winner_name, winner_score, created_at
     FROM game_results
     ORDER BY created_at DESC
     LIMIT $1`,
    [safeLimit]
  );

  return rows;
}
