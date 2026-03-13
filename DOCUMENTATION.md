# Skribble (Sketch Clash) — Complete Code Documentation

> **What is this project?**
> Skribble is a **real-time multiplayer drawing and guessing game** (like skribbl.io). One player draws a word on a canvas; everyone else tries to guess it in the chat. Points are awarded based on speed, and the highest scorer at the end wins.

---

## Table of Contents

1. [How the App Works — Big Picture](#1-how-the-app-works--big-picture)
2. [Tech Stack](#2-tech-stack)
3. [Project Folder Structure](#3-project-folder-structure)
4. [Backend — File by File](#4-backend--file-by-file)
   - [server.js](#41-serverjs)
   - [socketHandlers.js](#42-sockethandlersjs)
   - [services/GameService.js](#43-servicesgameservicejs)
   - [services/game/lifecycle.js](#44-servicesgamelifecyclejs)
   - [services/game/gameRound.js](#45-servicesgamegameroundjs)
   - [game/room.js](#46-gameroomjs)
   - [game/player.js](#47-gameplayerjs)
   - [utils/helpers.js](#48-utilshelpersjs)
   - [db/client.js](#49-dbclientjs)
   - [db/init.js](#410-dbinitjs)
   - [db/repository.js](#411-dbrepositoryjs)
   - [words.json](#412-wordsjson)
5. [Frontend — File by File](#5-frontend--file-by-file)
   - [main.tsx](#51-maintsx)
   - [App.tsx](#52-apptsx)
   - [socket.ts](#53-socketts)
   - [types.ts](#54-typests)
   - [GameContext.tsx](#55-gamecontexttsx)
   - [Landing.tsx](#56-landingtsx)
   - [CreateRoomForm.tsx](#57-createroomformtsx)
   - [JoinRoomForm.tsx](#58-joinroomformtsx)
   - [Lobby.tsx](#59-lobbytsx)
   - [RoomHeader.tsx](#510-roomheadertsx)
   - [PlayersCard.tsx](#511-playerscardtsx)
   - [SettingsCard.tsx](#512-settingscardtsx)
   - [LobbyActions.tsx](#513-lobbyactionstsx)
   - [GameScreen.tsx](#514-gamescreentsx)
   - [DrawingCanvas.tsx](#515-drawingcanvastsx)
   - [PlayerList.tsx](#516-playerlisttsx)
   - [WordChooser.tsx](#517-wordchoosertsx)
   - [ChatPanel.tsx](#518-chatpaneltsx)
   - [GameOver.tsx](#519-gameovertsx)
6. [Socket Events — Complete Reference](#6-socket-events--complete-reference)
7. [Game Phases — State Machine](#7-game-phases--state-machine)
8. [Scoring System](#8-scoring-system)
9. [Database Schema](#9-database-schema)
10. [Complete Game Flow — Step-by-Step Example](#10-complete-game-flow--step-by-step-example)
11. [Key Algorithms Explained](#11-key-algorithms-explained)
12. [How to Run Locally](#12-how-to-run-locally)

---

## 1. How the App Works — Big Picture

```
Browser (React)  ←──── Socket.IO ────→  Node.js Server
     │                                        │
     │  Sends events: create_room,            │  Holds all game rooms in memory (Map)
     │  guess, draw_data, etc.                │  Runs timers, checks guesses
     │                                        │
     └────── REST API (HTTP) ────────────────→ GET /api/results  (past games from DB)
```

- The **frontend** is a React + TypeScript app that shows the UI.
- The **backend** is a Node.js + Express server. The actual game logic runs over **WebSockets** (Socket.IO).
- All active game rooms live **in RAM** on the server (in a JavaScript `Map`). No database is needed to play — the database is optional and only stores history.
- Every player's browser is connected to the server with a persistent socket connection. When anything changes (a new stroke, a guess, a new player joining), the server broadcasts it to all players in that room instantly.

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 19 + TypeScript | UI components |
| Frontend Styling | Tailwind CSS v4 | All visual styling |
| Frontend Build | Vite | Fast dev server and production build |
| Frontend Canvas | Fabric.js v7 | Drawing canvas (freehand brush) |
| Realtime | Socket.IO (client) | Connects frontend to backend |
| Backend Runtime | Node.js (ESM modules) | Server-side JavaScript |
| Backend Framework | Express v5 | REST API routes |
| Realtime | Socket.IO (server) | WebSocket handling |
| Database | PostgreSQL (optional) | Store game history |
| DB Client | `pg` (node-postgres) | Run SQL queries from Node |
| Config | `dotenv` | Load `.env` variables |

---

## 3. Project Folder Structure

```
skribble/
├── backend/
│   ├── server.js               ← Entry point. HTTP + Socket.IO server
│   ├── socketHandlers.js       ← Maps socket events to game functions
│   ├── words.json              ← List of drawable words (strings array)
│   ├── .env.example            ← Environment variable template
│   ├── game/
│   │   ├── player.js           ← createPlayer() factory function
│   │   └── room.js             ← createRoom() + all room helper functions
│   ├── services/
│   │   ├── GameService.js      ← Assembles all handlers into one object
│   │   └── game/
│   │       ├── lifecycle.js    ← createRoom, joinRoom, startGame, disconnect
│   │       └── gameRound.js    ← drawing, guessing, hints, turn logic
│   ├── db/
│   │   ├── client.js           ← PostgreSQL connection pool
│   │   ├── init.js             ← CREATE TABLE IF NOT EXISTS statements
│   │   └── repository.js       ← All DB read/write functions
│   └── utils/
│       └── helpers.js          ← Pure utility functions (clamp, shuffle, etc.)
│
└── frontend/
    ├── index.html              ← Single HTML page
    ├── src/
    │   ├── main.tsx            ← React app entry; wraps App in GameProvider
    │   ├── App.tsx             ← Route switcher (landing/lobby/game/gameover)
    │   ├── socket.ts           ← Creates the single Socket.IO connection
    │   ├── types.ts            ← TypeScript interfaces for all shared data
    │   ├── GameContext.tsx     ← Global state + all socket event listeners
    │   └── components/
    │       ├── Landing.tsx         ← Home screen (create or join a room)
    │       ├── Lobby.tsx           ← Waiting room before the game starts
    │       ├── GameScreen.tsx      ← The main game UI (canvas + chat + players)
    │       ├── GameOver.tsx        ← Final leaderboard screen
    │       ├── DrawingCanvas.tsx   ← Canvas that drawer draws on
    │       ├── PlayerList.tsx      ← Sidebar list of players + scores
    │       ├── WordChooser.tsx     ← Drawer's word selection buttons
    │       ├── ChatPanel.tsx       ← Chat + guess input
    │       ├── landing/
    │       │   ├── CreateRoomForm.tsx  ← Form to configure and create a room
    │       │   └── JoinRoomForm.tsx    ← Form to join by room code
    │       └── lobby/
    │           ├── RoomHeader.tsx      ← Shows room code + copy invite button
    │           ├── PlayersCard.tsx     ← List of players with ready status
    │           ├── SettingsCard.tsx    ← Displays game settings
    │           └── LobbyActions.tsx   ← Ready and Start Game buttons
```

---

## 4. Backend — File by File

### 4.1 `server.js`

**What it does:** This is the **entry point** of the entire backend. It starts the HTTP server and the WebSocket server.

```
server.js
  ├── Creates Express app
  ├── Creates HTTP server wrapping Express
  ├── Creates Socket.IO server on top of the HTTP server
  ├── Registers two REST endpoints:
  │     GET /api/health   → Returns { ok: true } to check server is alive
  │     GET /api/results  → Returns last N game results from DB
  ├── Calls registerSocketHandlers(io) to attach game logic
  └── Calls initDatabase() then starts listening on PORT (default 3001)
```

**Simple Example:**
```
Client browser opens → HTTP server on port 3001 responds
Socket.IO connects   → WebSocket upgrade happens on same port
GET /api/health      → { ok: true }
GET /api/results?limit=5 → [ { winner_name: "Alice", winner_score: 350, ... } ]
```

**Key Point:** The server runs in **ESM module** mode (`"type": "module"` in package.json), which means you use `import` instead of `require`.

---

### 4.2 `socketHandlers.js`

**What it does:** Registers all socket event listeners. It is a thin mapping layer — it translates every incoming socket event to a specific game function.

```javascript
// When a client sends "create_room", call game.createRoom(socket, data)
socket.on("create_room",  (d) => game.createRoom(socket, d ?? {}));
socket.on("guess",        ({ roomId, text }) => game.submitGuess(socket, roomId, text));
// ... and so on for all 11 events
```

**Why it's separate:** Keeps `server.js` clean. All actual game logic lives in the service files.

**The `?? {}` trick:** If the client sends no data, default to an empty object to avoid crashes.

---

### 4.3 `services/GameService.js`

**What it does:** The **assembler**. It creates the shared `rooms` Map, creates the two handler groups (lifecycle and gameRound), and merges them into one object that `socketHandlers.js` uses.

```javascript
const rooms = new Map(); // e.g. { "ABC123" → roomObject, "XY9876" → roomObject }

const gameRound = createGameRoundHandlers({ io, rooms, words });
const lifecycle = createLifecycleHandlers({ io, rooms, gameRound });

return { ...lifecycle, chooseWord, handleStroke, ... }; // flat API
```

**Why `rooms` is a Map:** Each room needs a unique key (the 6-character room code). `Map` is efficient for constant-time lookups by key.

**Simple Example:**
```
GameService is created once when the server starts.
All 200 simultaneous players share the same rooms Map.
Room "ABC123" has 4 players; Room "XY9876" has 6 players — both live in the same Map.
```

---

### 4.4 `services/game/lifecycle.js`

**What it does:** Handles player and room **lifecycle events** — creating rooms, joining, toggling ready, starting the game, and disconnecting.

#### `createRoom(socket, { hostName, settings })`
1. Validates/trims the host name.
2. Generates a unique 6-character room code.
3. Creates a room object (`buildRoom()`), stores it in `rooms`.
4. Subscribes the socket to that room (`socket.join(roomId)` — Socket.IO room).
5. Emits `room_created` back to the creator.
6. Saves the room to the database (if connected).

#### `joinRoom(socket, { roomId, playerName })`
1. Looks up the room by code.
2. Checks: does it exist? Is it full? Is it in lobby phase?
3. If all checks pass, adds the player to the room's players Map.
4. Emits `joined_room` to joiner and `player_joined` to everyone in the room.

#### `toggleReady(socket, roomId)`
- Flips `player.ready` between `true` and `false`.
- Broadcasts updated lobby to everyone.

#### `startGame(socket, roomId)`
1. Only the host can call this.
2. Needs at least 2 players.
3. Resets all scores, sets phase to `"starting"`, calculates `totalTurns = rounds × playerCount`.
4. Calls `gameRound.nextTurn(room)` to kick off the first turn.

#### `requestState(socket, roomId)`
- Sends the full current game snapshot to the requesting socket. Used when a player reconnects.

#### `disconnect(socketId)`
1. Marks player as left in DB.
2. Removes them from their room.
3. If they were the host, assigns the next player as host.
4. If they were the **drawer**, ends the round early.
5. If the room is now empty, deletes it from memory.

---

### 4.5 `services/game/gameRound.js`

**What it does:** All the core **in-round** game logic — word selection, drawing, guessing, hints, scoring, and turn transitions.

#### `nextTurn(room)`
The central turn controller:
1. Clears any existing timers.
2. If `< 2 players`, goes back to lobby.
3. If `turnIndex >= totalTurns`, ends the game.
4. Otherwise, picks the next drawer (rotating through players by index).
5. Sets phase to `"word_select"`, picks 3 random word options.
6. Emits `round_start` to everyone, `word_options` only to the drawer.

#### `chooseWord(socket, roomId, word)`
- Validates the chosen word is in the options list.
- Stores it in `room.word`.
- Calls `startDrawing(room)`.

#### `startDrawing(room)`
1. Sets phase to `"drawing"`.
2. Records `room.roundEndAt = Date.now() + drawTime * 1000`.
3. Emits `word_chosen` (with masked word `_ _ _ _ _`) to everyone.
4. Emits `drawer_word` (the actual word) only to the drawer's socket.
5. Schedules hint reveals.
6. Sets a `setTimeout` to call `endRound(room, "time_up")` when time runs out.

#### `submitGuess(socket, roomId, text)`
The most complex function:
1. Rejects if drawer, already guessed, or wrong phase.
2. **Correct guess:** Awards `100 + remaining_seconds × 2` points. Sets `player.hasGuessed = true`. Calls `checkAllGuessed()`.
3. **Close guess (Levenshtein distance ≤ 2):** Sends a private hint: `"That's close!"` only to that player.
4. **Wrong guess:** Broadcasts it as a chat message to everyone.

#### `scheduleHints(room)`
- Spreads hint reveals evenly across the draw time.
- Example: 80s draw time, 2 hints → reveal at ~27s and ~54s.
- Each hint picks a random unrevealed letter position and reveals it.

#### `endRound(room, reason)`
- reasons: `"time_up"` | `"all_guessed"` | `"drawer_left"`
- Awards the **drawer +50 points** if at least one person guessed correctly.
- Broadcasts `round_end` with the real word and current scores.
- Waits 4 seconds, then increments `turnIndex` and calls `nextTurn()`.

#### `checkAllGuessed(room)`
- If every non-drawer player has `hasGuessed = true`, calls `endRound(room, "all_guessed")`.

#### `handleStroke(socket, roomId, stroke)` / `undoStroke` / `clearCanvas`
- `handleStroke`: Validates the stroke (clamps color, size, point count), saves it to `room.strokes`, broadcasts to all viewers.
- `undoStroke`: Removes the last stroke, re-broadcasts the full stroke array.
- `clearCanvas`: Empties `room.strokes`, re-broadcasts empty array.

---

### 4.6 `game/room.js`

**What it does:** A factory file for creating and reading room objects. Contains no logic — just data structure creation and read-only helper functions.

#### `createRoom({ id, hostId, hostName, settings })`
Returns a plain JavaScript object (the room):

| Field | Type | Description |
|---|---|---|
| `id` | string | 6-char room code e.g. `"ABC123"` |
| `hostId` | string | Socket ID of the creator |
| `settings` | object | maxPlayers, rounds, drawTime, wordChoices, hintCount |
| `players` | `Map<socketId, playerObj>` | All connected players |
| `phase` | string | Current game phase (see phase machine) |
| `turnIndex` | number | Which turn we are on (0-based) |
| `drawerId` | string\|null | Socket ID of current drawer |
| `word` | string\|null | The secret word for this round |
| `strokes` | array | All drawing strokes this round |
| `revealedIdx` | Set | Letter indices that have been hinted |
| `roundTimer` | Timeout | The timer that ends the round |
| `hintTimers` | array | Timers for each hint reveal |

#### Helper Functions

| Function | What it returns |
|---|---|
| `listPlayers(room)` | Array of plain player objects (safe to send over the network) |
| `roundNumber(room)` | Current round number (1-based) |
| `turnNumber(room)` | Current turn number (1-based) |
| `drawerName(room)` | Name of the current drawer |
| `maskedWord(room)` | Word as `"_ _ _ _ _"` with revealed letters shown |
| `clearTimers(room)` | Cancels round timer and all hint timers |
| `resetRound(room)` | Clears word, strokes, hints, and all hasGuessed flags |
| `roomSnapshot(room)` | Full safe-to-send object for the `game_state` event |

---

### 4.7 `game/player.js`

**What it does:** A tiny factory that creates a new player object.

```javascript
createPlayer("socket-id-abc", "Alice")
// Returns:
{ id: "socket-id-abc", name: "Alice", score: 0, ready: false, hasGuessed: false }
```

---

### 4.8 `utils/helpers.js`

**What it does:** Pure utility functions with no side effects. These are used throughout the backend.

| Function | What it does | Example |
|---|---|---|
| `clamp(value, min, max, fallback)` | Keeps a number inside a valid range | `clamp(500, 15, 240, 80)` → `240` |
| `normalize(text)` | Lowercases and trims for comparison | `normalize(" APPLE ")` → `"apple"` |
| `shuffle(arr)` | Fisher-Yates shuffle, returns new array | `shuffle([1,2,3])` → `[3,1,2]` |
| `pickRandom(arr, count)` | Picks N random unique items | `pickRandom(words, 3)` → `["tiger","apple","guitar"]` |
| `levenshtein(a, b)` | Edit distance between two strings | `levenshtein("catle","castle")` → `1` |
| `generateCode(existingIds)` | Random 6-char room code, no duplicates | `generateCode(rooms)` → `"HJ3KP2"` |

**Why `levenshtein` is useful:** Detects "close guesses" — if you type `"caste"` when the word is `"castle"`, the server knows it's close (distance = 1) and sends you a private `"That's close!"` hint instead of broadcasting your wrong guess.

---

### 4.9 `db/client.js`

**What it does:** Manages a single PostgreSQL **connection pool** for the whole server.

- Uses the `pg` library's `Pool` class (reuses connections rather than creating a new one per query).
- Only creates the pool when `DATABASE_URL` env variable is set.
- `hasDatabase()` → returns `true` if `DATABASE_URL` is set.
- `dbQuery(sql, params)` → executes a parameterized SQL query.

**Why a Pool?** Opening a new database connection for every query is slow. A pool keeps several connections open and reuses them.

**Security:** Uses parameterized queries (`$1, $2`), which prevent SQL injection.

---

### 4.10 `db/init.js`

**What it does:** Creates the required database tables when the server first starts. Uses `CREATE TABLE IF NOT EXISTS` so it's safe to run repeatedly.

**Tables created:**

| Table | Purpose |
|---|---|
| `rooms` | One row per game room (code, host, phase, settings) |
| `room_players` | One row per player per room session |
| `game_results` | One row per finished game (winner, score) |
| `game_result_players` | One row per player in each finished game (for leaderboard) |

If `DATABASE_URL` is not set, the server prints `"running with in-memory game state only"` and skips all DB operations seamlessly.

---

### 4.11 `db/repository.js`

**What it does:** All database read and write functions. Every function checks `hasDatabase()` first and returns early if there is no database.

| Function | When called |
|---|---|
| `insertRoom(roomId, hostName, settings)` | When a room is created |
| `updateRoomPhase(roomId, phase)` | When game starts or ends |
| `closeRoom(roomId)` | When game ends or room is deleted |
| `insertRoomPlayer(roomId, socketId, playerName)` | When a player joins |
| `markPlayerLeft(socketId)` | When a player disconnects |
| `saveGameResult({ roomId, winner, leaderboard })` | After `game_over` |
| `getRecentGameResults(limit)` | Called by `GET /api/results` |

---

### 4.12 `words.json`

A plain JSON array of strings — the word bank the game picks from.

```json
["apple", "banana", "tiger", "elephant", "guitar", "rocket", ...]
```

`pickRandom(words, 3)` picks 3 random words from this list and sends them to the drawer as word choices.

---

## 5. Frontend — File by File

### 5.1 `main.tsx`

**What it does:** The React app entry point. Mounts the app into `<div id="root">` in `index.html`.

```tsx
<StrictMode>         // Enables React development warnings
  <GameProvider>     // Makes all game state available to every component
    <App />          // The actual UI
  </GameProvider>
</StrictMode>
```

`GameProvider` wraps the entire app, so **any component** can read game state or call game actions without prop drilling.

---

### 5.2 `App.tsx`

**What it does:** A simple **screen router**. Based on the `screen` value from `GameContext`, it renders one of four screens.

```
screen === "landing"  → <Landing />    (default: home page)
screen === "lobby"    → <Lobby />      (waiting room)
screen === "game"     → <GameScreen /> (main game)
screen === "gameover" → <GameOver />   (results)
```

There is no React Router or URL routing here — the "route" is just a state variable.

---

### 5.3 `socket.ts`

**What it does:** Creates and returns the single Socket.IO connection to the backend. Uses a **singleton pattern** — the socket is only created once, no matter how many components call `getSocket()`.

```typescript
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
// In .env file: VITE_SERVER_URL=https://your-backend.com
```

**Why singleton?** Having two socket connections would mean the server sees the same player twice, causing duplicate messages.

---

### 5.4 `types.ts`

**What it does:** Defines TypeScript interfaces (data shapes) for everything passed between frontend and backend. No runtime code — purely for type safety.

| Interface | Represents |
|---|---|
| `PlayerInfo` | id, name, score, ready, hasGuessed |
| `StrokeData` | color, size, points array for one drawn line |
| `RoomSettings` | maxPlayers, rounds, drawTime, wordChoices, hintCount |
| `RoomSnapshot` | Full room state snapshot (sent as `game_state` event) |
| `ChatMsg` | A single chat message (can be system or player) |
| `GuessResult` | Correct guess event data (player, points) |
| `RoundEndPayload` | Round ended (reason, word, scores) |
| `GameOverPayload` | Game over (winner, final leaderboard) |

---

### 5.5 `GameContext.tsx`

**What it does:** The **brain of the entire frontend**. This is a React Context that:
1. Holds all game state in one place.
2. Listens to every socket event from the server.
3. Provides action functions (`createRoom`, `sendGuess`, etc.) to components.

#### State Fields

| Field | Type | Description |
|---|---|---|
| `screen` | string | Which screen to show (`landing / lobby / game / gameover`) |
| `playerId` | string | This browser's socket ID |
| `roomId` | string | The room code (e.g. `"ABC123"`) |
| `snapshot` | RoomSnapshot | Full current game state from server |
| `chatLog` | ChatMsg[] | All chat messages this round |
| `wordOptions` | string[] | Word choices shown to the drawer |
| `drawerWord` | string | The actual word (only set if you are the drawer) |
| `roundEndData` | RoundEndPayload | Data shown in the round-end overlay |
| `gameOverData` | GameOverPayload | Data shown on the game over screen |
| `error` | string | Error message (e.g. "Room not found") |
| `timer` | number | Countdown timer in seconds |

#### Socket Event Handlers (what each event does to state)

| Event received from server | Effect on frontend state |
|---|---|
| `room_created` | Sets `roomId`, `playerId`, switches screen to `"lobby"` |
| `joined_room` | Same as above |
| `lobby_update` | Updates `snapshot` with new player list/ready states |
| `game_state` | Updates `snapshot`, switches screen based on `phase` |
| `chat_message` | Appends to `chatLog` |
| `guess_result` | Appends a system message like `"Alice guessed it! (+250)"` |
| `word_options` | Sets `wordOptions` (triggers `WordChooser` overlay) |
| `drawer_word` | Sets `drawerWord` (only the drawer sees this) |
| `word_chosen` | Clears word options, starts `timer`, updates masked word |
| `hint_update` | Updates `maskedWord` in snapshot |
| `round_start` | Clears chat log, resets round data, switches to game screen |
| `round_end` | Sets `roundEndData`, adds system message with the word |
| `game_over` | Sets `gameOverData`, switches screen to `"gameover"` |
| `error_msg` | Sets `error` string (shown on landing page) |

#### Computed Values
```typescript
const isDrawer = state.snapshot?.drawerId === state.playerId;
const isHost   = state.snapshot?.hostId   === state.playerId;
```

These are **derived** from state — no extra storage needed.

#### Timer
```typescript
// Counts down from drawTime to 0 every second
useEffect(() => {
  if (state.timer <= 0) return;
  const id = setInterval(() => setState(prev => ({ ...prev, timer: prev.timer - 1 })), 1000);
  return () => clearInterval(id); // cleanup
}, [state.timer]);
```

---

### 5.6 `Landing.tsx`

**What it does:** The home/welcome screen. Shows the game title and renders two side-by-side forms.

```
Landing
  ├── <h1>  "🎨 Sketch Clash"  (gradient title)
  ├── <CreateRoomForm onCreateRoom={createRoom} />
  ├── <JoinRoomForm   onJoinRoom={joinRoom}   />
  └── {error && <p>error message</p>}
```

It pulls `createRoom`, `joinRoom`, and `error` from `GameContext` and passes the action functions down as props to the sub-forms.

---

### 5.7 `CreateRoomForm.tsx`

**What it does:** A form with all the game settings. When submitted, calls `onCreateRoom(hostName, settings)`.

**Settings the host can configure:**
| Setting | Default | Range |
|---|---|---|
| Your Name | "Host" | max 24 chars |
| Max Players | 8 | 2–20 |
| Rounds | 3 | 1–10 |
| Draw Time | 80s | 15–240s |
| Word Choices | 3 | 1–5 |
| Hint Count | 2 | 0–5 |
| Private | true | checkbox |

**Example usage:**
```
Host fills in name "Alice", keeps defaults, clicks "Create Room"
→ socket.emit("create_room", { hostName: "Alice", settings: { maxPlayers:8, rounds:3, ... } })
→ Server responds with room_created { roomId: "HJ3KP2", playerId: "sock-abc" }
→ App switches to Lobby screen
```

---

### 5.8 `JoinRoomForm.tsx`

**What it does:** Simple 2-field form. Player enters their name and a 6-character room code.

```
Bob enters name="Bob", code="HJ3KP2" → clicks "Join Room"
→ socket.emit("join_room", { roomId: "HJ3KP2", playerName: "Bob" })
```

The code is `.toUpperCase()`'d automatically so capitalization doesn't matter.

---

### 5.9 `Lobby.tsx`

**What it does:** The waiting room shown after joining a room, before the game starts. Composes four sub-components.

```
Lobby
  ├── <RoomHeader roomId="HJ3KP2" />
  ├── <PlayersCard  snapshot={...} playerId={...} />
  ├── <SettingsCard snapshot={...} />
  └── <LobbyActions isHost canStart onToggleReady onStartGame />
```

If `snapshot` is null (data hasn't arrived yet), renders nothing.

---

### 5.10 `RoomHeader.tsx`

**What it does:** Displays the room code and a "Copy Invite" button.

```
Room: HJ3KP2   [Copy Invite]
```

Clicking "Copy Invite" copies `http://localhost:5173?room=HJ3KP2` to the clipboard. (This link doesn't auto-join yet — it's just for sharing the code.)

---

### 5.11 `PlayersCard.tsx`

**What it does:** Shows a list of players with their ready/waiting status.

```
Players (2/8)
  ✅ Ready  Alice (Host)
  ⏳ Waiting Bob    (you)
```

- Green background = ready
- Grey background = not ready
- `(you)` highlights your own row in purple

---

### 5.12 `SettingsCard.tsx`

**What it does:** Displays the room settings (read-only, no editing in lobby).

```
Settings
Rounds: 3
Draw Time: 80s
Word Choices: 3
Hints: 2
Private: Yes
```

---

### 5.13 `LobbyActions.tsx`

**What it does:** The buttons at the bottom of the lobby.

```
[Toggle Ready]   [Start Game]  ← Start only visible to host
```

- **Toggle Ready** — any player can click it to flip their ready status.
- **Start Game** — only the host sees it; it's disabled if `< 2 players`.

---

### 5.14 `GameScreen.tsx`

**What it does:** The main game screen layout. Three-column design.

```
┌──────────────────────────────────────────────────────── Top bar ─────┐
│  Room: HJ3KP2  Round 1/3  Turn 2/6          C _ T L E       ⏱ 45s  │
└──────────────────────────────────────────────────────────────────────┘

┌── Players ──┐  ┌─────── Canvas ─────────────┐  ┌── Chat ──────────┐
│ #1 Alice 300│  │  [word chooser if drawing] │  │ Bob: cat?        │
│ #2 Bob   150│  │                             │  │ 🟣 Alice found it│
│ #3 Carol  50│  │      [drawing canvas]       │  │ > type guess...  │
└─────────────┘  └─────────────────────────────┘  └──────────────────┘
```

**Top bar logic:**
- `word_select` + drawer → pulsing amber "Pick a word!"
- `word_select` + not drawer → "{drawerName} is picking a word..."
- `drawing` + drawer → shows the **real word** (e.g. "castle")
- `drawing` + not drawer → shows **masked word** (e.g. "C _ _ _ L E")
- `round_end` → "The word was: castle"

**Round End Overlay:** A full-screen modal appears at `round_end` phase showing the word, then disappears automatically.

---

### 5.15 `DrawingCanvas.tsx`

**What it does:** The drawing canvas, powered by **Fabric.js**.

#### How it works for the DRAWER:
1. Fabric.js is initialized with `isDrawingMode = true`.
2. A `PencilBrush` is attached with the chosen color and size.
3. When the user finishes a stroke, Fabric emits `"path:created"`.
4. The component extracts the points from Fabric's path data.
5. Sends `socket.emit("draw_data", { stroke: { color, size, points } })` to the server.
6. Server saves it and broadcasts to all viewers.

#### How it works for the VIEWER:
1. Canvas has `isDrawingMode = false` (can't draw).
2. Listens for `socket.on("draw_data")` → calls `drawStroke(stroke)` using the raw Canvas 2D API to paint the line.
3. Listens for `socket.on("canvas_state")` → calls `redrawAll(strokes)` to repaint every stroke.

#### Toolbar (drawer only):
- **Color picker** → changes brush color
- **Size slider** → 1–24px brush size
- **Undo** → emits `draw_undo`; server removes last stroke; all clients redraw
- **Clear** → emits `canvas_clear`; server clears all strokes; all clients see empty canvas

---

### 5.16 `PlayerList.tsx`

**What it does:** Sidebar during the game. Shows players ranked by score.

```
Players
  #1  Alice 🖌️    300   ← amber: current drawer
  #2  Bob ✅      250   ← green: already guessed
  #3  Carol       100   ← grey: still guessing (you) ← purple ring
```

Players are sorted by score descending.

---

### 5.17 `WordChooser.tsx`

**What it does:** An overlay panel that appears **only** when `isDrawer === true` and `wordOptions.length > 0`.

```
Pick a word to draw:
[ tiger ]   [ bicycle ]   [ castle ]
```

Clicking a word calls `chooseWord(word)` → `socket.emit("word_chosen", { roomId, word })`.

After a word is chosen, the server sends `word_options: []` (empty) or the component unmounts naturally because `wordOptions` becomes empty.

---

### 5.18 `ChatPanel.tsx`

**What it does:** Shows all messages and the input box. Dual-purpose: guessing or chatting.

**Logic:**
```
If phase === "drawing" AND you are NOT the drawer:
  → input sends a GUESS (socket.emit "guess") — could score points
  → placeholder: "Type your guess..."

Otherwise (lobby, word_select, round_end, or you ARE the drawer):
  → input sends CHAT (socket.emit "chat") — just a message, no scoring
  → placeholder: "Chat..."

If you ARE the drawer during drawing phase:
  → input is DISABLED (you can't see guesses in chat anyway, you know the word)
```

The chat log auto-scrolls to the bottom whenever a new message arrives.

---

### 5.19 `GameOver.tsx`

**What it does:** Final screen shown when all turns are done.

```
🏆 Game Over!

Alice wins with 450 pts!

#   Player    Score
1   Alice      450    ← gold
2   Bob        300
3   Carol      150

[ Back to Home ]
```

Clicking "Back to Home" calls `goLanding()` which resets all state to the initial values.

---

## 6. Socket Events — Complete Reference

### Events: Client → Server

| Event | Payload | What Happens |
|---|---|---|
| `create_room` | `{ hostName, settings }` | Creates a new room, emits `room_created` back |
| `join_room` | `{ roomId, playerName }` | Joins existing room, emits `joined_room` + `player_joined` |
| `toggle_ready` | `{ roomId }` | Flips your ready state, broadcasts `lobby_update` |
| `start_game` | `{ roomId }` | Host starts game, triggers first turn |
| `word_chosen` | `{ roomId, word }` | Drawer picks a word, triggers drawing phase |
| `draw_data` | `{ roomId, stroke }` | Sends a stroke, server saves + rebroadcasts |
| `draw_undo` | `{ roomId }` | Removes last stroke, rebroadcasts canvas state |
| `canvas_clear` | `{ roomId }` | Clears all strokes, rebroadcasts |
| `guess` | `{ roomId, text }` | Submits a guess; scored if correct |
| `chat` | `{ roomId, text }` | Sends a plain chat message |
| `request_state` | `{ roomId }` | Server resends `game_state` to this socket |

### Events: Server → Client

| Event | Payload | When Sent |
|---|---|---|
| `room_created` | `{ roomId, playerId }` | After successful room creation |
| `joined_room` | `{ roomId, playerId }` | After successfully joining |
| `player_joined` | `{ player, players }` | Broadcast when someone new joins |
| `player_left` | `{ playerId, playerName }` | Broadcast when someone disconnects |
| `lobby_update` | `RoomSnapshot` | After any lobby state change |
| `game_state` | `RoomSnapshot` | After any in-game state change |
| `round_start` | `{ round, turn, drawerId, drawTime, ... }` | At start of each turn |
| `word_options` | `{ options: string[] }` | Sent only to drawer before they pick |
| `drawer_word` | `{ word: string }` | Sent only to drawer after word is picked |
| `word_chosen` | `{ drawerId, maskedWord, drawTime }` | Broadcast: drawing phase begins |
| `draw_data` | `{ stroke }` | Broadcast each new stroke |
| `canvas_state` | `{ strokes }` | Full canvas redraw (after undo/clear) |
| `hint_update` | `{ maskedWord }` | A letter was revealed |
| `guess_result` | `{ correct, playerId, playerName, points }` | Correct guess made |
| `chat_message` | `{ playerId?, playerName?, text, system? }` | Chat or system message |
| `round_end` | `{ reason, word, scores }` | Round is over |
| `game_over` | `{ winner, leaderboard }` | All turns finished |
| `error_msg` | `{ message }` | Something went wrong |

---

## 7. Game Phases — State Machine

The `room.phase` field controls what actions are valid at each point.

```
        ┌─────────────────────────────────────────────────┐
        │                 "lobby"                          │
        │   Players join, toggle ready, host starts game   │
        └───────────────────┬─────────────────────────────┘
                            │ host clicks Start Game (≥2 players)
                            ▼
        ┌─────────────────────────────────────────────────┐
        │               "starting"                         │
        │   (brief transitional phase)                     │
        └───────────────────┬─────────────────────────────┘
                            │ nextTurn() runs immediately
                            ▼
        ┌─────────────────────────────────────────────────┐
        │              "word_select"                       │
        │   Drawer sees 3 word options, picks one          │
        └───────────────────┬─────────────────────────────┘
                            │ drawer picks word
                            ▼
        ┌─────────────────────────────────────────────────┐
        │               "drawing"                          │
        │   Drawer draws, others guess, hints drop in      │
        └───────────────────┬─────────────────────────────┘
                            │ time_up OR all_guessed OR drawer_left
                            ▼
        ┌─────────────────────────────────────────────────┐
        │              "round_end"                         │
        │   Word revealed, scores shown, 4s pause          │
        └──────┬────────────────────────────┬─────────────┘
               │ more turns left            │ all turns done
               ▼                            ▼
         (back to word_select)        "game_over"
                                   Final leaderboard saved to DB
                                   Players can go back to landing
```

---

## 8. Scoring System

### Points for Guessers
```
Points = 100 + (remainingSeconds × 2)
```

| Guess time | Remaining seconds | Points earned |
|---|---|---|
| Immediately (80s draw time) | 80 | 100 + 160 = **260 pts** |
| Halfway through (40s left) | 40 | 100 + 80 = **180 pts** |
| Last second (1s left) | 1 | 100 + 2 = **102 pts** |

### Points for Drawer
- **+50 points** if at least one person guessed correctly.
- **0 bonus** if no one guessed.

### "That's close!" Hint
- If your guess has a Levenshtein edit distance of 1 or 2 from the real word:
  - You privately receive: *"That's close!"*
  - Your guess is **not** broadcast to the chat (so others don't see how close you were)
  - You can keep guessing

---

## 9. Database Schema

```sql
-- One row per room session
CREATE TABLE rooms (
  id          VARCHAR(12) PRIMARY KEY,   -- e.g. "HJ3KP2"
  host_name   VARCHAR(64),
  phase       VARCHAR(20) DEFAULT 'lobby',
  settings    JSONB,                     -- { maxPlayers, rounds, ... }
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  ended_at    TIMESTAMPTZ                -- NULL until game ends
);

-- One row per player joining a room
CREATE TABLE room_players (
  room_id     VARCHAR(12) REFERENCES rooms(id),
  socket_id   VARCHAR(128),
  player_name VARCHAR(64),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  left_at     TIMESTAMPTZ,              -- NULL until player leaves
  PRIMARY KEY (room_id, socket_id)
);

-- One row per completed game
CREATE TABLE game_results (
  id           SERIAL PRIMARY KEY,
  room_id      VARCHAR(12),
  winner_name  VARCHAR(64),
  winner_score INT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- One row per player per completed game (for full leaderboard history)
CREATE TABLE game_result_players (
  id              SERIAL PRIMARY KEY,
  game_result_id  INT REFERENCES game_results(id),
  player_name     VARCHAR(64),
  score           INT
);
```

**The game works without a database** — if `DATABASE_URL` env var is not set, all `repository.js` functions return early and the game runs purely in memory.

---

## 10. Complete Game Flow — Step-by-Step Example

Let's trace an **entire game** with 2 players, Alice (host) and Bob.

### Step 1: Alice Creates a Room
```
Alice fills CreateRoomForm:  name="Alice", rounds=2, drawTime=60, 3 word choices
→ socket.emit("create_room", { hostName:"Alice", settings:{rounds:2,drawTime:60,...} })

Server:
  1. generateCode() → "HJ3KP2"
  2. createRoom() → room object stored in rooms Map
  3. createPlayer("sock-A", "Alice") added to room.players
  4. socket.join("HJ3KP2")  (Alice's socket joins the Socket.IO room)
  5. socket.emit("room_created", { roomId:"HJ3KP2", playerId:"sock-A" })
  6. broadcastLobby(room) → lobby_update sent to Alice

Frontend (Alice):
  → screen = "lobby"
  → roomId = "HJ3KP2"
  → playerId = "sock-A"
```

### Step 2: Bob Joins
```
Bob opens app, enters name="Bob", code="HJ3KP2", clicks Join
→ socket.emit("join_room", { roomId:"HJ3KP2", playerName:"Bob" })

Server:
  1. rooms.get("HJ3KP2") → found
  2. phase === "lobby" → OK, not full → OK
  3. createPlayer("sock-B", "Bob") added
  4. socket.join("HJ3KP2")
  5. socket.emit("joined_room", ...) → Bob's screen = lobby
  6. io.to("HJ3KP2").emit("player_joined", { player:{name:"Bob"}, players:[Alice,Bob] })
  7. broadcastLobby(room) → both Alice and Bob get updated player list
```

### Step 3: Alice Starts the Game
```
Alice clicks "Start Game"
→ socket.emit("start_game", { roomId:"HJ3KP2" })

Server:
  1. room.hostId === "sock-A" ✓
  2. room.players.size === 2 ✓
  3. Reset scores to 0
  4. totalTurns = 2 rounds × 2 players = 4 turns
  5. room.phase = "starting"
  6. gameRound.nextTurn(room)

nextTurn(room):
  1. turnIndex=0, drawerId = players[0 % 2] = "sock-A" (Alice draws first)
  2. phase = "word_select"
  3. wordOptions = pickRandom(words, 3) = ["castle", "tiger", "bicycle"]
  4. io.to("HJ3KP2").emit("round_start", { round:1, turn:1, drawerId:"sock-A", ... })
  5. io.to("sock-A").emit("word_options", { options:["castle","tiger","bicycle"] })
```

### Step 4: Alice Picks a Word
```
Alice sees WordChooser with 3 options, clicks "castle"
→ socket.emit("word_chosen", { roomId:"HJ3KP2", word:"castle" })

Server:
  1. phase === "word_select" ✓, drawerId === "sock-A" ✓
  2. room.word = "castle"
  3. startDrawing(room):
     - phase = "drawing"
     - roundEndAt = now + 60000ms
     - io.to("HJ3KP2").emit("word_chosen", { maskedWord:"_ _ _ _ _ _", drawTime:60 })
     - io.to("sock-A").emit("drawer_word", { word:"castle" })
     - scheduleHints: hints at ~20s and ~40s
     - setTimeout(endRound, 60000)
```

### Step 5: Alice Draws
```
Alice draws on canvas → Fabric.js detects path:created
→ socket.emit("draw_data", { roomId:"HJ3KP2", stroke:{ color:"#ff0000", size:4, points:[...] } })

Server:
  1. validates stroke (clamp size, trim points)
  2. room.strokes.push(safeStroke)
  3. io.to("HJ3KP2").emit("draw_data", { stroke:safeStroke })

Bob's canvas:
  4. receives "draw_data" → drawStroke() renders the red line
```

### Step 6: Bob Guesses
```
At t=30s (30 seconds remaining):
Bob types "caste" in chat input → handleSubmit sends it as a guess
→ socket.emit("guess", { roomId:"HJ3KP2", text:"caste" })

Server:
  1. player = Bob, not drawer, hasn't guessed
  2. normalize("caste") !== normalize("castle")
  3. levenshtein("caste","castle") = 1 ≤ 2
  4. socket.emit("chat_message", { system:true, text:"That's close!" })  ← only to Bob

Bob tries again: "castle"
→ socket.emit("guess", { roomId:"HJ3KP2", text:"castle" })

Server:
  1. normalize("castle") === normalize("castle") ✓ CORRECT
  2. remaining = ceil((roundEndAt - now) / 1000) = 28 seconds
  3. points = 100 + 28×2 = 156
  4. Bob.score += 156, Bob.hasGuessed = true, room.hasCorrectGuess = true
  5. io.to("HJ3KP2").emit("guess_result", { correct:true, playerName:"Bob", points:156 })
  6. broadcastState(room)
  7. checkAllGuessed: [Bob] → all non-drawers guessed → endRound(room, "all_guessed")

endRound:
  1. Alice (drawer) gets +50 because hasCorrectGuess = true → Alice.score = 50
  2. phase = "round_end"
  3. io.to("HJ3KP2").emit("round_end", { reason:"all_guessed", word:"castle", scores:[Bob:156, Alice:50] })
  4. setTimeout 4000ms → turnIndex++ → nextTurn(room)  [Turn 2: Bob draws]
```

### Steps 7–9: Remaining Turns
- Turn 2: Bob draws (turnIndex=1, `1 % 2 = 1` = Bob)
- Turn 3: Alice draws (turnIndex=2, `2 % 2 = 0` = Alice)
- Turn 4: Bob draws (turnIndex=3, `3 % 2 = 1` = Bob)

### Step 10: Game Over
```
After turn 4: turnIndex(4) >= totalTurns(4)

Server:
  1. phase = "game_over"
  2. leaderboard = [Bob:500, Alice:200]  (sorted by score)
  3. io.to("HJ3KP2").emit("game_over", { winner:{name:"Bob",score:500}, leaderboard:[...] })
  4. saveGameResult({ roomId:"HJ3KP2", winner:Bob, leaderboard })  → DB
  5. closeRoom("HJ3KP2")  → DB: ended_at = NOW()

Frontend (both):
  → screen = "gameover"
  → Shows leaderboard, "Bob wins with 500 pts!"
```

---

## 11. Key Algorithms Explained

### Levenshtein Distance
Used to detect "close" guesses. Counts the minimum number of single-character edits (insert, delete, substitute) needed to turn one word into another.

```
"catle" → "castle"
  Add 's' after 'a': catle → casle  (1 edit)
  Substitute 'l'→'t', wait...
  Actually: insert 'a' between 'c' and 't': "castle"
  Distance = 1
```

If distance ≤ 2, the server privately tells you "That's close!" and hides your guess from the chat so others can't benefit.

### Word Masking
```javascript
maskedWord(room):
  "castle" with revealedIdx = Set{1}  (position 1 = 'a' revealed)
  →  "_ a _ _ _ _"   (spaces between each character for readability)
```

### Room Code Generation
```javascript
const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// Note: no O, I, 0, 1 to avoid visual confusion
// Picks 6 random characters → e.g. "HJ3KP2"
// Recursively retries if code already exists (extremely rare)
```

### Score Formula
```
Points = 100 (base) + remainingSeconds × 2 (speed bonus)

Fast guesser at 1s left:  100 + 1×2  = 102 pts
Fast guesser at 80s left: 100 + 80×2 = 260 pts
```

### Hint Timing
```
drawTime = 80s, hintCount = 2
Hint 1 fires at: 80s × (1/(2+1)) = ~26.7s
Hint 2 fires at: 80s × (2/(2+1)) = ~53.3s

Formula: delay = floor(drawTime × 1000 × h / (hintCount + 1))
```

---

## 12. How to Run Locally

### Prerequisites
- Node.js v18+
- (Optional) PostgreSQL database

### Backend
```bash
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL=postgresql://... (or leave blank to run without DB)
npm install
npm start          # production
npm run dev        # development with nodemon (auto-restart)
```

Server starts at `http://localhost:3001`

### Frontend
```bash
cd frontend
npm install
# Create .env.local if backend is not on localhost:
# VITE_SERVER_URL=http://localhost:3001
npm run dev        # starts Vite dev server
```

Frontend opens at `http://localhost:5173`

### Environment Variables

**Backend `.env`:**
```
DATABASE_URL=postgresql://user:password@host/dbname   # optional
PORT=3001                                              # default 3001
```

**Frontend `.env.local` (optional):**
```
VITE_SERVER_URL=http://localhost:3001
```

### Quick Test (2 players locally)
1. Start backend: `npm start` in `/backend`
2. Start frontend: `npm run dev` in `/frontend`
3. Open `http://localhost:5173` in **two separate browser tabs**
4. In Tab 1: Create a room → note the room code
5. In Tab 2: Join with that room code
6. In Tab 1: Click "Start Game"
7. Play!
