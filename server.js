import "dotenv/config";
import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import { registerSocketHandlers } from "./socketHandlers.js";
import { initDatabase } from "./db/init.js";
import { getRecentGameResults } from "./db/repository.js";

const app    = express();
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
    server.listen(PORT, () => console.log(`Server → http://localhost:${PORT}`));
  });
