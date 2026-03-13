import "dotenv/config";
import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import { registerSocketHandlers } from "./socketHandlers.js";
import { initDatabase } from "./db/init.js";
import { cleanupExpiredRooms, closeOpenRoomsOnBoot, getPublicRooms, getRecentGameResults } from "./db/repository.js";

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: "*" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/results", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const rows = await getRecentGameResults(limit);
    res.json({ results: rows });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch results" });
  }
});

app.get("/api/rooms/public", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const rows = await getPublicRooms(limit);
    res.json({ rooms: rows });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch public rooms" });
  }
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

registerSocketHandlers(io);

const PORT = process.env.PORT || 3001;

initDatabase()
  .catch((err) => {
    console.error("DB init failed:", err.message);
  })
  .finally(() => {
    closeOpenRoomsOnBoot().catch((err) => {
      console.error("DB startup cleanup failed:", err.message);
    });

    setInterval(() => {
      cleanupExpiredRooms().catch((err) => {
        console.error("DB cleanup failed:", err.message);
      });
    }, 5 * 60 * 1000);

    server.listen(PORT, () => console.log(`Server → http://localhost:${PORT}`));
  });
