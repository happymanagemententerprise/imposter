# Agent Coding Guidelines (`agent.md`)

## Core Principles
1. **Modularity:** Separate frontend display logic (TV View) from controller logic (Phone View) and server-side state management.
2. **In-Memory State:** Do not use databases. Manage all lobbies, users, and game states entirely in server memory.
3. **Real-time Synchronization:** Use WebSockets (via Socket.io) to instantly push state changes, role assignments, and inputs between clients and the server.
4. **Minimal Dependencies:** Keep the technology stack lean (Node.js, Express, Socket.io) to ensure smooth deployment and fast build times on Render.

## Coding Workflow
- Maintain clear event-driven communication protocols for socket connections (`join-lobby`, `start-game`, `submit-word`, `submit-vote`).
- Handle dropped connections gracefully without crashing the active game session.

## Conventions
- The server is the single source of truth. Clients only render state and emit intents.
- Never send the secret word or role to the TV view or to other players; emit role info only to the owning socket.
- Validate every incoming event (phase, player membership, input length) before mutating state.
- Keep game logic as pure functions in `server/game/` so it can be tested without sockets.
- Use plain JavaScript modules with no build step unless a bundler becomes necessary.
