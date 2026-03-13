import { clamp } from "../utils/helpers.js";
import { createPlayer } from "./player.js";

export function createRoom({ id, hostId, hostName, settings = {} }) {
  const room = {
    id,
    hostId,
    isPrivate: Boolean(settings.private),

    settings: {
      maxPlayers: clamp(settings.maxPlayers, 2, 20, 8),
      rounds: clamp(settings.rounds, 1, 10, 3),
      drawTime: clamp(settings.drawTime, 15, 240, 80),
      wordChoices: clamp(settings.wordChoices, 1, 5, 3),
      hintCount: clamp(settings.hintCount, 0, 5, 2),
    },

    players: new Map(),

    phase: "lobby",
    turnIndex: 0,
    totalTurns: 0,
    drawerId: null,
    word: null,
    wordOptions: [],
    revealedIdx: new Set(),
    strokes: [],
    roundTimer: null,
    roundEndAt: null,
    hintTimers: [],
    hasCorrectGuess: false,
  };

  room.players.set(hostId, createPlayer(hostId, hostName));
  return room;
}

export function listPlayers(room) {
  return [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    ready: p.ready,
    hasGuessed: p.hasGuessed,
  }));
}

export function roundNumber(room) {
  return Math.floor(room.turnIndex / Math.max(room.players.size, 1)) + 1;
}

export function turnNumber(room) {
  return room.turnIndex + 1;
}

export function drawerName(room) {
  return room.players.get(room.drawerId)?.name ?? "";
}

export function maskedWord(room) {
  if (!room.word) return "";
  return room.word
    .split("")
    .map((ch, i) => {
      if (ch === " ") return "  ";
      return room.revealedIdx.has(i) ? ch : "_";
    })
    .join(" ");
}

export function clearTimers(room) {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }
  room.hintTimers.forEach((t) => clearTimeout(t));
  room.hintTimers = [];
}

export function resetRound(room) {
  room.word = null;
  room.wordOptions = [];
  room.revealedIdx = new Set();
  room.strokes = [];
  room.hasCorrectGuess = false;
  room.players.forEach((p) => {
    p.hasGuessed = false;
  });
}

export function roomSnapshot(room) {
  return {
    roomId: room.id,
    hostId: room.hostId,
    isPrivate: room.isPrivate,
    settings: room.settings,
    phase: room.phase,
    players: listPlayers(room),
    drawerId: room.drawerId,
    drawerName: drawerName(room),
    round: roundNumber(room),
    turn: turnNumber(room),
    totalTurns: room.totalTurns,
    maskedWord: maskedWord(room),
    strokes: room.strokes,
  };
}
