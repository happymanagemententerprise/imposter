# Impostor Game

A real-time, web-based social deduction game designed to be played in a group setting using a shared **TV View** (central screen) and individual **Phone Views** (player controllers).

Built with Node.js, Express, and Socket.io for low-latency communication and easy deployment on Render.

---

## 🎮 Game Flow & Overview

1. **Lobby:** The first player creates a room and shares its code. Other players join from their phones, while the TV view subscribes to the room using its code.
2. **Role Assignment:** When the round starts, players receive a secret word on their phones. One player is randomly chosen as the **Impostor** and receives a notification instead of the secret word.
3. **Clue Submission:** After a 7-second role reveal, players have 60 seconds to submit a unique, one-word clue related to the secret word.
4. **TV Display:** All submitted clues are revealed simultaneously on the main TV screen.
5. **Voting & Elimination:** Players discuss the clues and vote on who they believe the Impostor is via their phones.
6. **Win Conditions:**
   - **Players Win:** The Impostor is correctly identified and voted out.
- **Impostor Wins:** The Impostor survives a vote with three or fewer players left.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express
- **Real-Time Messaging:** Socket.io
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (Mobile-first controller & TV display UI)
- **Deployment Platform:** Render

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) (v16 or higher) installed.

### 2. Installation
Clone the repository and install the dependencies:

```bash
git clone https://github.com/YOUR_USERNAME/impostor-game.git
cd impostor-game
npm install
```

### 3. Run the Server

```bash
npm start
```

The server runs on `http://localhost:3000` by default (or the port set in `PORT`).

### 4. Play Locally
- Open `http://localhost:3000/tv` on a laptop or TV browser.
- Open `http://<your-local-ip>:3000` on the first phone and create a room. Enter its room code on the TV and share it with the other phones.
- At least three connected players are required. The host controls voting and advancing rounds from their phone.

---

## 📁 Project Structure

```
├─ server/
│  ├─ index.js          # Express + Socket.io bootstrap
│  ├─ sockets.js        # Socket event wiring
│  └─ game/
│     ├─ engine.js      # Game rules and phase transitions
│     ├─ lobby.js       # Room state and public state projection
│     └─ words.js       # Secret word list
├─ public/
│  ├─ phone/            # Controller view
│  ├─ tv/               # Display view
│  └─ css/theme.css     # Design system tokens
└─ package.json
```

---

## 🔌 Socket Events

| Event | Direction | Purpose |
|---|---|---|
| `join-lobby` | client → server | Join with a display name |
| `start-game` | client → server | Start the round and assign roles |
| `submit-word` | client → server | Submit a clue (duplicates rejected) |
| `submit-vote` | client → server | Vote for a suspected player |
| `watch-room` | TV → server | Subscribe to public room state |
| `begin-vote` | host → server | Open voting after clue reveal |
| `next-round` | host → server | Advance after voting |

---

## ☁️ Deploying to Render

1. Push the repository to GitHub.
2. In Render, create a new **Web Service** and connect the repo.
3. Set **Build Command** to `npm install` and **Start Command** to `npm start`.
4. Deploy. Render provides the `PORT` environment variable automatically.

> **Note:** Game state lives in server memory. A restart or redeploy ends any active game, and the service should run as a single instance. Secret roles and words are sent only to the owning player's phone.

---

## 📚 Documentation

- [PRD](./PRD.md)
- [Agent Coding Guidelines](./agent.md)
- [Design System](./design_system.md)
- [Architecture](./architecture.md)
