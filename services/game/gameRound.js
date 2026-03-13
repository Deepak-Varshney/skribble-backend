import {
  listPlayers,
  roundNumber,
  turnNumber,
  drawerName,
  maskedWord,
  clearTimers,
  resetRound,
  roomSnapshot,
} from "../../game/room.js";
import { clamp, normalize, pickRandom } from "../../utils/helpers.js";
import { saveGameResult, closeRoom, updateRoomPhase } from "../../db/repository.js";

export function createGameRoundHandlers({ io, rooms, words }) {
  function chooseWord(socket, roomId, word) {
    const room = rooms.get(roomId);
    if (!room || room.phase !== "word_select" || room.drawerId !== socket.id) return;

    const selectedWord = normalize(word);
    room.word = room.wordOptions.includes(selectedWord) ? selectedWord : room.wordOptions[0];
    startDrawing(room);
  }

  function handleStroke(socket, roomId, stroke) {
    const room = rooms.get(roomId);
    if (!room || room.phase !== "drawing" || room.drawerId !== socket.id) return;
    if (!stroke?.points?.length || stroke.points.length < 2) return;

    const safeStroke = {
      color: String(stroke.color || "#111111").slice(0, 16),
      size: clamp(stroke.size, 1, 32, 4),
      points: stroke.points.slice(0, 2000).map((p) => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 })),
    };

    room.strokes.push(safeStroke);
    io.to(room.id).emit("draw_data", { stroke: safeStroke });
  }

  function undoStroke(socket, roomId) {
    const room = rooms.get(roomId);
    if (!room || room.phase !== "drawing" || room.drawerId !== socket.id) return;

    room.strokes.pop();
    io.to(room.id).emit("canvas_state", { strokes: room.strokes });
  }

  function clearCanvas(socket, roomId) {
    const room = rooms.get(roomId);
    if (!room || room.phase !== "drawing" || room.drawerId !== socket.id) return;

    room.strokes = [];
    io.to(room.id).emit("canvas_state", { strokes: room.strokes });
  }

  function submitGuess(socket, roomId, text) {
    const room = rooms.get(roomId);
    if (!room || room.phase !== "drawing") return;

    const player = room.players.get(socket.id);
    if (!player || socket.id === room.drawerId || player.hasGuessed) return;

    const guess = String(text ?? "").trim().slice(0, 80);
    if (!guess) return;

    if (normalize(guess) === normalize(room.word)) {
      const remaining = Math.max(0, Math.ceil((room.roundEndAt - Date.now()) / 1000));
      const points = 100 + remaining * 2;

      player.score += points;
      player.hasGuessed = true;
      room.hasCorrectGuess = true;

      io.to(room.id).emit("guess_result", {
        correct: true,
        playerId: player.id,
        playerName: player.name,
        points,
      });

      broadcastState(room);
      checkAllGuessed(room);
      return;
    }

    io.to(room.id).emit("chat_message", { playerId: player.id, playerName: player.name, text: guess });
  }

  function sendChat(socket, roomId, text) {
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const msg = String(text ?? "").trim().slice(0, 120);
    if (msg) io.to(room.id).emit("chat_message", { playerId: player.id, playerName: player.name, text: msg });
  }

  function nextTurn(room) {
    clearTimers(room);

    if (room.players.size < 2) {
      room.phase = "lobby";
      room.drawerId = null;
      resetRound(room);

      io.to(room.id).emit("chat_message", { system: true, text: "Not enough players - back to lobby." });
      updateRoomPhase(room.id, "lobby").catch((e) => console.error("DB updateRoomPhase:", e.message));
      broadcastLobby(room);
      return;
    }

    if (room.turnIndex >= room.totalTurns) {
      room.phase = "game_over";
      const leaderboard = listPlayers(room).sort((a, b) => b.score - a.score);

      io.to(room.id).emit("game_over", {
        winner: leaderboard[0] ?? null,
        leaderboard,
      });

      saveGameResult({
        roomId: room.id,
        winner: leaderboard[0] ?? null,
        leaderboard,
      }).catch((err) => {
        console.error("DB: failed to save game result", err.message);
      });

      closeRoom(room.id).catch((e) => console.error("DB closeRoom:", e.message));

      broadcastState(room);
      return;
    }

    const ids = [...room.players.keys()];
    room.drawerId = ids[room.turnIndex % ids.length];
    room.phase = "word_select";
    resetRound(room);
    room.wordOptions = pickRandom(words, room.settings.wordChoices);

    io.to(room.id).emit("round_start", {
      round: roundNumber(room),
      turn: turnNumber(room),
      totalTurns: room.totalTurns,
      drawerId: room.drawerId,
      drawerName: drawerName(room),
      drawTime: room.settings.drawTime,
      selecting: true,
    });

    io.to(room.drawerId).emit("word_options", { options: room.wordOptions });
    broadcastState(room);
  }

  function startDrawing(room) {
    room.phase = "drawing";
    room.roundEndAt = Date.now() + room.settings.drawTime * 1000;

    io.to(room.id).emit("word_chosen", {
      drawerId: room.drawerId,
      maskedWord: maskedWord(room),
      drawTime: room.settings.drawTime,
    });

    io.to(room.drawerId).emit("drawer_word", { word: room.word });

    scheduleHints(room);
    room.roundTimer = setTimeout(() => endRound(room, "time_up"), room.settings.drawTime * 1000);
  }

  function scheduleHints(room) {
    if (room.settings.hintCount <= 0 || !room.word) return;

    const positions = room.word
      .split("")
      .map((ch, i) => (ch !== " " ? i : -1))
      .filter((i) => i >= 0);

    const hintLimit = Math.min(room.settings.hintCount, positions.length);
    const pool = [...positions];

    for (let h = 1; h <= hintLimit; h++) {
      const delay = Math.floor((room.settings.drawTime * 1000 * h) / (hintLimit + 1));

      const hintTimer = setTimeout(() => {
        if (room.phase !== "drawing" || !pool.length) return;

        const randomIndex = Math.floor(Math.random() * pool.length);
        room.revealedIdx.add(pool.splice(randomIndex, 1)[0]);
        io.to(room.id).emit("hint_update", { maskedWord: maskedWord(room) });
      }, delay);

      room.hintTimers.push(hintTimer);
    }
  }

  function endRound(room, reason) {
    if (room.phase !== "drawing") return;

    clearTimers(room);

    if (room.hasCorrectGuess && room.drawerId && room.players.has(room.drawerId)) {
      room.players.get(room.drawerId).score += 50;
    }

    room.phase = "round_end";
    const scores = listPlayers(room).sort((a, b) => b.score - a.score);

    io.to(room.id).emit("round_end", {
      reason,
      word: room.word,
      scores,
    });

    broadcastState(room);

    setTimeout(() => {
      room.turnIndex++;
      nextTurn(room);
    }, 4000);
  }

  function checkAllGuessed(room) {
    const guessers = [...room.players.values()].filter((p) => p.id !== room.drawerId);
    if (guessers.length === 0 || guessers.every((p) => p.hasGuessed)) {
      endRound(room, "all_guessed");
    }
  }

  function broadcastLobby(room) {
    io.to(room.id).emit("lobby_update", roomSnapshot(room));
  }

  function broadcastState(room) {
    io.to(room.id).emit("game_state", roomSnapshot(room));
  }

  return {
    chooseWord,
    handleStroke,
    undoStroke,
    clearCanvas,
    submitGuess,
    sendChat,
    nextTurn,
    endRound,
    checkAllGuessed,
    broadcastLobby,
    broadcastState,
  };
}
