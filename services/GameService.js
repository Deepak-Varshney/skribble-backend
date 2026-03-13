import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLifecycleHandlers } from "./game/lifecycle.js";
import { createGameRoundHandlers } from "./game/gameRound.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORDS = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../words.json"), "utf-8"));

export function createGameService(io) {
  const rooms = new Map();

  const gameRound = createGameRoundHandlers({
    io,
    rooms,
    words: WORDS,
  });

  const lifecycle = createLifecycleHandlers({
    io,
    rooms,
    gameRound,
  });

  return {
    ...lifecycle,
    chooseWord: gameRound.chooseWord,
    handleStroke: gameRound.handleStroke,
    undoStroke: gameRound.undoStroke,
    clearCanvas: gameRound.clearCanvas,
    submitGuess: gameRound.submitGuess,
    sendChat: gameRound.sendChat,
  };
}
