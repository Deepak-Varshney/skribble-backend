# Skribble Backend (Sketch Clash)

Node.js + Express + Socket.IO backend for a real-time multiplayer drawing and guessing game (skribbl.io clone).

## Live Links

- Backend Live URL: https://skribble-backend-8snk.onrender.com
- Frontend Repo: https://github.com/Deepak-Varshney/skribble-frontend
- Backend Repo: https://github.com/Deepak-Varshney/skribble-backend

## Tech Stack

- Node.js (ES modules)
- Express 5
- Socket.IO
- PostgreSQL (`pg`) optional but supported

## Core Backend Responsibilities

- Room lifecycle (create, join, lobby updates, start game)
- Real-time game round flow (drawer turn, word pick, drawing, guesses, hints)
- Score calculation and game-over winner
- Room/session persistence metadata in DB
- Public room listing and room expiry cleanup

## API Endpoints

- `GET /api/health`
- `GET /api/results?limit=10`
- `GET /api/rooms/public?limit=20`

## Socket Events

### Client -> Server

- `create_room`
- `join_room`
- `toggle_ready`
- `start_game`
- `delete_room`
- `leave_room`
- `word_chosen`
- `draw_data`
- `draw_undo`
- `canvas_clear`
- `guess`
- `chat`
- `request_state`

### Server -> Client

- `room_created`
- `joined_room`
- `lobby_update`
- `game_state`
- `round_start`
- `word_options`
- `word_chosen`
- `drawer_word`
- `draw_data`
- `canvas_state`
- `hint_update`
- `guess_result`
- `chat_message`
- `round_end`
- `game_over`
- `error_msg`

## Local Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

Create `.env`:

```env
PORT=3001
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

Notes:
- `DATABASE_URL` is optional for basic gameplay.
- Without DB URL, app runs with in-memory game state.

### 3. Run

```bash
npm start
```

For dev auto-reload:

```bash
npm run dev
```

Open: `http://localhost:3001`

## Architecture Overview

- `server.js` sets up Express APIs + Socket.IO and registers handlers.
- `socketHandlers.js` maps socket events to game service methods.
- `services/game/lifecycle.js` handles room/player lifecycle.
- `services/game/gameRound.js` handles drawing/guessing/round transitions.
- `game/room.js` + `game/player.js` provide plain object factories/helpers.
- `db/repository.js` stores room metadata, sessions, and game results.

## Functional Checklist Mapping

### Must Have

- Create room with configurable settings: Yes
- Join room via link or code: Yes
- Lobby with player list + host start: Yes
- Turn-based rounds: Yes
- Real-time drawing sync: Yes
- Word selection (1-5 choices): Yes
- Guessing with points: Yes
- Scoring and leaderboard: Yes
- Game end with winner: Yes
- Basic drawing tools support (server side sync): Yes

### Should Have

- Hints: Yes
- Chat: Yes
- Draw countdown support: Yes
- Private rooms via invite flow: Yes

### Nice to Have

- Word categories: No
- Eraser-specific server mode: No
- Kick/Ban: No
- Votekick: No
- Multiple languages: No

## Deployment Notes

- Use a platform with WebSocket support (Render/Railway).
- Redeploy backend after any API/socket event change.
- If frontend gets 404 for backend route, verify backend deploy is on latest commit.
