import { GameService } from "./services/GameService.js";

export function registerSocketHandlers(io) {
  const game = new GameService(io);

  io.on("connection", (socket) => {
    socket.on("create_room",  (d) => game.createRoom(socket, d ?? {}));
    socket.on("join_room",    (d) => game.joinRoom(socket, d ?? {}));
    socket.on("toggle_ready", ({ roomId }) => game.toggleReady(socket, roomId));
    socket.on("start_game",   ({ roomId }) => game.startGame(socket, roomId));
    socket.on("word_chosen",  ({ roomId, word }) => game.chooseWord(socket, roomId, word));
    socket.on("draw_data",    ({ roomId, stroke }) => game.handleStroke(socket, roomId, stroke));
    socket.on("draw_undo",    ({ roomId }) => game.undoStroke(socket, roomId));
    socket.on("canvas_clear", ({ roomId }) => game.clearCanvas(socket, roomId));
    socket.on("guess",        ({ roomId, text }) => game.submitGuess(socket, roomId, text));
    socket.on("chat",         ({ roomId, text }) => game.sendChat(socket, roomId, text));
    socket.on("request_state",({ roomId }) => game.requestState(socket, roomId));
    socket.on("disconnect",   () => game.disconnect(socket.id));
  });
}
