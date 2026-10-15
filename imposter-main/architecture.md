# Architecture (`architecture.md`)

## System Topology
The application uses a client-server architecture hosted on a single Node.js instance on Render.

```
 Phone (controller)  ─┐
 Phone (controller)  ─┼── WebSocket (Socket.io) ──►  Node.js + Express
 TV (display view)   ─┘                              ├─ static file serving
                                                     ├─ socket event handlers
                                                     └─ in-memory game state
```

## Components
- **Express server:** Serves static assets for the phone view (`/`) and TV view (`/tv`).
- **Socket.io server:** Handles all real-time communication.
- **Game state manager:** In-memory store of lobbies, players, roles, clues, and votes.
- **Phone client:** Join form, role reveal, clue input, voting UI.
- **TV client:** Lobby roster, clue grid, vote results, win screen.

## Suggested Project Structure
```
/
├─ server/
│  ├─ index.js          # Express + Socket.io bootstrap
│  ├─ sockets.js        # event wiring
│  └─ game/
│     ├─ lobby.js       # lobby + player management
│     ├─ engine.js      # phase transitions, win checks
│     └─ words.js       # secret word list
├─ public/
│  ├─ phone/            # controller view
│  ├─ tv/               # display view
│  └─ css/theme.css     # design system tokens
├─ package.json
└─ render.yaml (optional)
```

## State Model (in memory)
```js
lobbies: Map<roomCode, {
  hostId, phase,            // 'lobby' | 'clue' | 'display' | 'vote' | 'ended'
  secretWord, impostorId,
  players: Map<playerId, { name, socketId, alive, connected }>,
  clues: Map<playerId, string>,
  votes: Map<playerId, targetPlayerId>,
  timers: { clueDeadline }
}>
```

## Phase State Machine
`lobby` → `clue` → `display` → `vote` → (`clue` again if Impostor survives and players remain above threshold) → `ended`

## Socket Events
| Event | Direction | Purpose |
|---|---|---|
| `join-lobby` | client → server | Join with display name |
| `start-game` | client → server | Host starts; assigns roles |
| `role-assigned` | server → one client | Secret word or Impostor notice (private) |
| `submit-word` | client → server | Submit clue; rejects duplicates |
| `clues-revealed` | server → all | Broadcast all clues to TV and phones |
| `submit-vote` | client → server | Vote for a suspected player |
| `vote-result` | server → all | Eliminated player and outcome |
| `game-over` | server → all | Winner and Impostor reveal |
| `state-update` | server → all | Roster and phase sync |

## Game Rules Enforced Server-Side
- Duplicate clues rejected (case-insensitive, trimmed).
- Clue timer: 5-10 seconds before input opens/closes; missing clues are left blank.
- Vote ties: no elimination, revote or skip (decide during implementation).
- Impostor wins when alive players drop to the threshold (2 or 3) without a successful vote-out.

## Resilience
- Assign each player a `playerId` stored in `sessionStorage`; on reconnect, rebind the new socket to the existing player.
- Mark disconnected players `connected: false` rather than deleting them mid-game.
- Clean up empty or idle lobbies after a timeout to free memory.
- Because state is in memory, a Render restart or redeploy ends active games; this is accepted.

## Deployment (Render)
- **Service type:** Web Service (Node)
- **Build command:** `npm install`
- **Start command:** `node server/index.js`
- **Port:** read from `process.env.PORT`
- Single instance only (in-memory state means no horizontal scaling). Free-tier cold starts may delay the first connection.
