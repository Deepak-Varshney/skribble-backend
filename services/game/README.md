# Game Service Split

This folder keeps the backend game service easy to understand.

## Files

- `lifecycle.js`
Handles room lifecycle and lobby actions:
create room, join room, ready, start game, request state, disconnect.

- `gameRound.js`
Handles drawing and round logic:
word choose, strokes, guessing, scoring, hints, round end, game end.

## Why this split

- Smaller files are easier for beginners.
- Each file has one clear responsibility.
- `services/GameService.js` only wires modules together.
