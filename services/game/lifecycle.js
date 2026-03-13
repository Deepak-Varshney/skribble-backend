import { createRoom as buildRoom, clearTimers, roomSnapshot, listPlayers } from "../../game/room.js";
import { createPlayer } from "../../game/player.js";
import { generateCode } from "../../utils/helpers.js";
import {
  insertRoom,
  insertRoomPlayer,
  updateRoomPhase,
  closeRoom,
  markPlayerLeft,
} from "../../db/repository.js";

export function createLifecycleHandlers({ io, rooms, gameRound }) {
  function createRoom(socket, { hostName, settings }) {
    const name = String(hostName || "Host").trim().slice(0, 24) || "Host";
    const roomId = generateCode(rooms);
    const room = buildRoom({ id: roomId, hostId: socket.id, hostName: name, settings: settings ?? {} });

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.emit("room_created", { roomId, playerId: socket.id });

    // Persist room + host session to DB
    insertRoom(roomId, name, room.settings).catch((e) => console.error("DB insertRoom:", e.message));
    insertRoomPlayer(roomId, socket.id, name).catch((e) => console.error("DB insertRoomPlayer:", e.message));

    gameRound.broadcastLobby(room);
  }

  function joinRoom(socket, { roomId, playerName }) {
    const room = rooms.get(String(roomId ?? "").toUpperCase());
    if (!room) return socket.emit("error_msg", { message: "Room not found." });
    if (room.players.size >= room.settings.maxPlayers) return socket.emit("error_msg", { message: "Room is full." });
    if (room.phase !== "lobby") return socket.emit("error_msg", { message: "Game already in progress." });

    const name = String(playerName || "Player").trim().slice(0, 24) || "Player";
    room.players.set(socket.id, createPlayer(socket.id, name));

    socket.join(room.id);
    socket.emit("joined_room", { roomId: room.id, playerId: socket.id });
    io.to(room.id).emit("player_joined", { player: { id: socket.id, name }, players: listPlayers(room) });

    // Persist player session to DB
    insertRoomPlayer(room.id, socket.id, name).catch((e) => console.error("DB insertRoomPlayer:", e.message));

    gameRound.broadcastLobby(room);
  }

  function toggleReady(socket, roomId) {
    const room = rooms.get(roomId);
    if (!room || room.phase !== "lobby") return;

    const player = room.players.get(socket.id);
    if (!player) return;

    player.ready = !player.ready;
    gameRound.broadcastLobby(room);
  }

  function startGame(socket, roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.hostId !== socket.id) return socket.emit("error_msg", { message: "Only host can start." });
    if (room.players.size < 2) return socket.emit("error_msg", { message: "Need at least 2 players." });

    room.players.forEach((p) => {
      p.score = 0;
      p.hasGuessed = false;
      p.ready = false;
    });

    room.phase = "starting";
    room.turnIndex = 0;
    room.totalTurns = room.settings.rounds * room.players.size;

    // Update room phase in DB
    updateRoomPhase(room.id, "playing").catch((e) => console.error("DB updateRoomPhase:", e.message));

    gameRound.nextTurn(room);
  }

  function requestState(socket, roomId) {
    const room = rooms.get(roomId);
    if (room) socket.emit("game_state", roomSnapshot(room));
  }

  function disconnect(socketId) {
    // Always mark this socket's session as ended in DB
    markPlayerLeft(socketId).catch((e) => console.error("DB markPlayerLeft:", e.message));

    for (const room of rooms.values()) {
      if (!room.players.has(socketId)) continue;

      const leaving = room.players.get(socketId);
      room.players.delete(socketId);

      if (room.hostId === socketId) room.hostId = [...room.players.keys()][0] ?? null;

      io.to(room.id).emit("player_left", {
        playerId: socketId,
        playerName: leaving?.name ?? "Player",
      });

      if (room.players.size === 0) {
        clearTimers(room);
        rooms.delete(room.id);
        closeRoom(room.id).catch((e) => console.error("DB closeRoom:", e.message));
        return;
      }

      if (room.phase === "drawing" && room.drawerId === socketId) {
        io.to(room.id).emit("chat_message", { system: true, text: "Drawer left - round ended early." });
        gameRound.endRound(room, "drawer_left");
      } else if (room.phase !== "lobby") {
        gameRound.checkAllGuessed(room);
        gameRound.broadcastState(room);
      } else {
        gameRound.broadcastLobby(room);
      }

      return;
    }
  }

  return {
    createRoom,
    joinRoom,
    toggleReady,
    startGame,
    requestState,
    disconnect,
  };
}
