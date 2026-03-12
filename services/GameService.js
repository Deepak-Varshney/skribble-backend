import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Room } from "../models/Room.js";
import { Player } from "../models/Player.js";
import { clamp, normalize, pickRandom, generateCode, levenshtein } from "../utils/helpers.js";
import { saveGameResult } from "../db/repository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORDS = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../words.json"), "utf-8"));

export class GameService {
  constructor(io) {
    this.io = io;
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
  }

  /* ── Room lifecycle ──────────────────────────────── */

  createRoom(socket, { hostName, settings }) {
    const name = String(hostName || "Host").trim().slice(0, 24) || "Host";
    const roomId = generateCode(this.rooms);
    const room = new Room({ id: roomId, hostId: socket.id, hostName: name, settings: settings ?? {} });
    this.rooms.set(roomId, room);
    socket.join(roomId);
    socket.emit("room_created", { roomId, playerId: socket.id });
    this.#broadcastLobby(room);
  }

  joinRoom(socket, { roomId, playerName }) {
    const room = this.rooms.get(String(roomId ?? "").toUpperCase());
    if (!room) return socket.emit("error_msg", { message: "Room not found." });
    if (room.players.size >= room.settings.maxPlayers) return socket.emit("error_msg", { message: "Room is full." });
    if (room.phase !== "lobby") return socket.emit("error_msg", { message: "Game already in progress." });

    const name = String(playerName || "Player").trim().slice(0, 24) || "Player";
    room.players.set(socket.id, new Player(socket.id, name));
    socket.join(room.id);
    socket.emit("joined_room", { roomId: room.id, playerId: socket.id });
    this.io.to(room.id).emit("player_joined", { player: { id: socket.id, name }, players: room.listPlayers() });
    this.#broadcastLobby(room);
  }

  toggleReady(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== "lobby") return;
    const p = room.players.get(socket.id);
    if (p) { p.ready = !p.ready; this.#broadcastLobby(room); }
  }

  startGame(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit("error_msg", { message: "Only host can start." });
    if (room.players.size < 2) return socket.emit("error_msg", { message: "Need at least 2 players." });

    room.players.forEach(p => { p.score = 0; p.hasGuessed = false; p.ready = false; });
    room.phase = "starting";
    room.turnIndex = 0;
    room.totalTurns = room.settings.rounds * room.players.size;
    this.#nextTurn(room);
  }

  /* ── Word selection ─────────────────────────────── */

  chooseWord(socket, roomId, word) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== "word_select" || room.drawerId !== socket.id) return;
    const w = normalize(word);
    room.word = room.wordOptions.includes(w) ? w : room.wordOptions[0];
    this.#startDrawing(room);
  }

  /* ── Drawing ────────────────────────────────────── */

  handleStroke(socket, roomId, stroke) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== "drawing" || room.drawerId !== socket.id) return;
    if (!stroke?.points?.length || stroke.points.length < 2) return;

    const safe = {
      color: String(stroke.color || "#111111").slice(0, 16),
      size: clamp(stroke.size, 1, 32, 4),
      points: stroke.points.slice(0, 2000).map(p => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 })),
    };
    room.strokes.push(safe);
    this.io.to(room.id).emit("draw_data", { stroke: safe });
  }

  undoStroke(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== "drawing" || room.drawerId !== socket.id) return;
    room.strokes.pop();
    this.io.to(room.id).emit("canvas_state", { strokes: room.strokes });
  }

  clearCanvas(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== "drawing" || room.drawerId !== socket.id) return;
    room.strokes = [];
    this.io.to(room.id).emit("canvas_state", { strokes: room.strokes });
  }

  /* ── Guessing / Chat ────────────────────────────── */

  submitGuess(socket, roomId, text) {
    const room = this.rooms.get(roomId);
    if (!room || room.phase !== "drawing") return;
    const player = room.players.get(socket.id);
    if (!player || socket.id === room.drawerId || player.hasGuessed) return;

    const guess = String(text ?? "").trim().slice(0, 80);
    if (!guess) return;

    if (normalize(guess) === normalize(room.word)) {
      const remaining = Math.max(0, Math.ceil((room.roundEndAt - Date.now()) / 1000));
      const pts = 100 + remaining * 2;
      player.score += pts;
      player.hasGuessed = true;
      room.hasCorrectGuess = true;

      this.io.to(room.id).emit("guess_result", { correct: true, playerId: player.id, playerName: player.name, points: pts });
      this.#broadcastState(room);
      this.#checkAllGuessed(room);
      return;
    }

    // close guess detection
    const dist = levenshtein(normalize(guess), normalize(room.word));
    if (dist <= 2 && dist > 0) {
      socket.emit("chat_message", { system: true, text: "That's close!" });
      return;
    }

    // wrong guess → show as chat
    this.io.to(room.id).emit("chat_message", { playerId: player.id, playerName: player.name, text: guess });
  }

  sendChat(socket, roomId, text) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    const msg = String(text ?? "").trim().slice(0, 120);
    if (msg) this.io.to(room.id).emit("chat_message", { playerId: p.id, playerName: p.name, text: msg });
  }

  requestState(socket, roomId) {
    const room = this.rooms.get(roomId);
    if (room) socket.emit("game_state", room.snapshot());
  }

  /* ── Disconnect ─────────────────────────────────── */

  disconnect(socketId) {
    for (const room of this.rooms.values()) {
      if (!room.players.has(socketId)) continue;

      const leaving = room.players.get(socketId);
      room.players.delete(socketId);

      if (room.hostId === socketId) room.hostId = [...room.players.keys()][0] ?? null;

      this.io.to(room.id).emit("player_left", { playerId: socketId, playerName: leaving?.name ?? "Player" });

      if (room.players.size === 0) {
        room.clearTimers();
        this.rooms.delete(room.id);
        return;
      }

      if (room.phase === "drawing" && room.drawerId === socketId) {
        this.io.to(room.id).emit("chat_message", { system: true, text: "Drawer left – round ended early." });
        this.#endRound(room, "drawer_left");
      } else if (room.phase !== "lobby") {
        this.#checkAllGuessed(room);
        this.#broadcastState(room);
      } else {
        this.#broadcastLobby(room);
      }
      return;
    }
  }

  /* ── Private turn / round mechanics ─────────────── */

  #nextTurn(room) {
    room.clearTimers();
    if (room.players.size < 2) {
      room.phase = "lobby"; room.drawerId = null; room.resetRound();
      this.io.to(room.id).emit("chat_message", { system: true, text: "Not enough players – back to lobby." });
      this.#broadcastLobby(room);
      return;
    }
    if (room.turnIndex >= room.totalTurns) {
      room.phase = "game_over";
      const lb = room.listPlayers().sort((a, b) => b.score - a.score);
      this.io.to(room.id).emit("game_over", { winner: lb[0] ?? null, leaderboard: lb });

      // Persist final result when DB is configured.
      saveGameResult({ roomId: room.id, winner: lb[0] ?? null, leaderboard: lb }).catch((err) => {
        console.error("DB: failed to save game result", err.message);
      });

      this.#broadcastState(room);
      return;
    }

    const ids = [...room.players.keys()];
    room.drawerId = ids[room.turnIndex % ids.length];
    room.phase = "word_select";
    room.resetRound();
    room.wordOptions = pickRandom(WORDS, room.settings.wordChoices);

    this.io.to(room.id).emit("round_start", {
      round: room.roundNumber(), turn: room.turnNumber(),
      totalTurns: room.totalTurns,
      drawerId: room.drawerId, drawerName: room.drawerName(),
      drawTime: room.settings.drawTime, selecting: true,
    });
    this.io.to(room.drawerId).emit("word_options", { options: room.wordOptions });
    this.#broadcastState(room);
  }

  #startDrawing(room) {
    room.phase = "drawing";
    room.roundEndAt = Date.now() + room.settings.drawTime * 1000;

    this.io.to(room.id).emit("word_chosen", {
      drawerId: room.drawerId,
      maskedWord: room.maskedWord(),
      drawTime: room.settings.drawTime,
    });
    this.io.to(room.drawerId).emit("drawer_word", { word: room.word });

    this.#scheduleHints(room);
    room.roundTimer = setTimeout(() => this.#endRound(room, "time_up"), room.settings.drawTime * 1000);
  }

  #scheduleHints(room) {
    if (room.settings.hintCount <= 0 || !room.word) return;
    const positions = room.word.split("").map((ch, i) => ch !== " " ? i : -1).filter(i => i >= 0);
    const limit = Math.min(room.settings.hintCount, positions.length);
    const pool = [...positions];

    for (let h = 1; h <= limit; h++) {
      const delay = Math.floor((room.settings.drawTime * 1000 * h) / (limit + 1));
      const t = setTimeout(() => {
        if (room.phase !== "drawing" || !pool.length) return;
        const ri = Math.floor(Math.random() * pool.length);
        room.revealedIdx.add(pool.splice(ri, 1)[0]);
        this.io.to(room.id).emit("hint_update", { maskedWord: room.maskedWord() });
      }, delay);
      room.hintTimers.push(t);
    }
  }

  #endRound(room, reason) {
    if (room.phase !== "drawing") return;
    room.clearTimers();

    if (room.hasCorrectGuess && room.drawerId && room.players.has(room.drawerId)) {
      room.players.get(room.drawerId).score += 50;
    }
    room.phase = "round_end";
    const scores = room.listPlayers().sort((a, b) => b.score - a.score);
    this.io.to(room.id).emit("round_end", { reason, word: room.word, scores });
    this.#broadcastState(room);

    setTimeout(() => { room.turnIndex++; this.#nextTurn(room); }, 4000);
  }

  #checkAllGuessed(room) {
    const guessers = [...room.players.values()].filter(p => p.id !== room.drawerId);
    if (guessers.length === 0 || guessers.every(p => p.hasGuessed)) {
      this.#endRound(room, "all_guessed");
    }
  }

  #broadcastLobby(room) { this.io.to(room.id).emit("lobby_update", room.snapshot()); }
  #broadcastState(room) { this.io.to(room.id).emit("game_state", room.snapshot()); }
}
