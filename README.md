# Classic Chess ♟

A Progressive Web App for classic 1v1 chess — play on the same device (offline) or challenge a friend online.

## Architecture Principles

- **Offline mode is 100% independent of the server.** It works without any internet connection once the PWA is installed/cached.
- **Online mode uses Socket.IO and the Node.js/Express server.** The server is authoritative for game state and clocks.
- **PWA-first:** The app is installable and works offline via a Workbox-generated service worker (`vite-plugin-pwa`).

See [`architecture.md`](./ARCHITECTURE.md) for the full design.

---

## Project Structure

```
chess-game/
├── client/              # React + Vite frontend (PWA)
│   ├── src/
│   │   ├── components/  # Shared UI components (Board, Timer, …)
│   │   ├── pages/       # HomePage, OfflinePage, OnlinePage
│   │   ├── hooks/       # useLocalGame, useLocalClock, useOnlineGame, useSocket
│   │   ├── services/    # socket.js singleton
│   │   ├── utils/       # chess.js helpers, localStorage helpers
│   │   ├── data/        # constants (TIME_MODES, TIMED_CLOCK, …)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css    # Global design system
│   └── package.json
│
├── server/              # Node.js + Express + Socket.IO backend
│   ├── src/
│   │   ├── server.js    # Entry point
│   │   ├── socket/      # index.js + handlers.js
│   │   ├── game/        # gameSession.js + gameManager.js
│   │   └── utils/       # helpers.js
│   └── package.json
│
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### 1. Install dependencies

```bash
# Client
cd client && npm install

# Server
cd ../server && npm install
```

### 2. Start the development servers

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
# → http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# → http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Modes

| Mode | Server required? | Clock | Persistence |
|---|---|---|---|
| Offline | ❌ No | Browser `setInterval` | `localStorage` |
| Online | ✅ Yes (Socket.IO) | Server-authoritative | In-memory (server) |

## Time Controls

| Mode | Initial | Increment |
|---|---|---|
| Timed | 15 minutes | +5 seconds per move |
| Unlimited | ∞ | — |

---

## PWA Installation

1. Open the app in Chrome or Edge.
2. Click the **Install** button in the address bar.
3. The app is installed and the offline mode works without internet.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, react-router-dom |
| Chess UI | react-chessboard |
| Chess Rules | chess.js |
| Realtime | Socket.IO (client + server) |
| Backend | Node.js, Express |
| PWA | vite-plugin-pwa, Workbox |
| Styling | Vanilla CSS (design system) |
