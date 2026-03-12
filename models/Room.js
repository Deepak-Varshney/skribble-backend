import { Player } from "./Player.js";
import { clamp } from "../utils/helpers.js";

export class Room {
  constructor({ id, hostId, hostName, settings }) {
    this.id = id;
    this.hostId = hostId;
    this.isPrivate = Boolean(settings.private);

    this.settings = {
      maxPlayers: clamp(settings.maxPlayers, 2, 20, 8),
      rounds:     clamp(settings.rounds, 1, 10, 3),
      drawTime:   clamp(settings.drawTime, 15, 240, 80),
      wordChoices:clamp(settings.wordChoices, 1, 5, 3),
      hintCount:  clamp(settings.hintCount, 0, 5, 2),
    };

    this.players = new Map();
    this.players.set(hostId, new Player(hostId, hostName));

    // game state
    this.phase      = "lobby";   // lobby | word_select | drawing | round_end | game_over
    this.turnIndex  = 0;
    this.totalTurns = 0;
    this.drawerId   = null;
    this.word        = null;
    this.wordOptions = [];
    this.revealedIdx = new Set();
    this.strokes     = [];
    this.roundTimer  = null;
    this.roundEndAt  = null;
    this.hintTimers  = [];
    this.hasCorrectGuess = false;
  }

  /* ── helpers ─────────────────────────────────────── */

  listPlayers() {
    return [...this.players.values()].map(p => ({
      id: p.id, name: p.name, score: p.score,
      ready: p.ready, hasGuessed: p.hasGuessed,
    }));
  }

  roundNumber()  { return Math.floor(this.turnIndex / Math.max(this.players.size, 1)) + 1; }
  turnNumber()   { return this.turnIndex + 1; }
  drawerName()   { return this.players.get(this.drawerId)?.name ?? ""; }

  maskedWord() {
    if (!this.word) return "";
    return this.word.split("").map((ch, i) => {
      if (ch === " ") return "  ";
      return this.revealedIdx.has(i) ? ch : "_";
    }).join(" ");
  }

  clearTimers() {
    if (this.roundTimer) { clearTimeout(this.roundTimer); this.roundTimer = null; }
    this.hintTimers.forEach(t => clearTimeout(t));
    this.hintTimers = [];
  }

  resetRound() {
    this.word = null;
    this.wordOptions = [];
    this.revealedIdx = new Set();
    this.strokes = [];
    this.hasCorrectGuess = false;
    this.players.forEach(p => { p.hasGuessed = false; });
  }

  snapshot() {
    return {
      roomId: this.id, hostId: this.hostId,
      isPrivate: this.isPrivate, settings: this.settings,
      phase: this.phase, players: this.listPlayers(),
      drawerId: this.drawerId, drawerName: this.drawerName(),
      round: this.roundNumber(), turn: this.turnNumber(),
      totalTurns: this.totalTurns,
      maskedWord: this.maskedWord(),
      strokes: this.strokes,
    };
  }
}
