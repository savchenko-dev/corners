# Corners (Уголки)

Two-player online Corners game. Node.js + WebSockets, no database, single container.

## Rules
- 8×8 board, each player has 9 pieces in a 3×3 corner.
- On your turn move one piece: either one step orthogonally to an empty square,
  or jump orthogonally over any piece (yours or the opponent's) onto an empty square.
  Jumps can be chained in one move.
- First player to move all 9 pieces into the opponent's corner wins.

## Run locally
```sh
npm install
npm start          # http://localhost:3000
npm test
```

## Play
1. Open the site, click **Create game**.
2. Send the room code or **Copy link** to your friend.
3. Friend opens the link (or enters the code). First to join is White, second is Black; anyone else spectates.

## Deploy on Coolify
1. Push this repo to GitHub/GitLab.
2. In Coolify: **New Resource → Application → Git repository**, pick the repo.
3. Build pack: **Dockerfile** (default `Dockerfile` in repo root). Alternatively choose **Docker Compose** and point at `docker-compose.yml`.
4. Set **Port** to `3000` (the app also honors the `PORT` env var).
5. Assign a domain and enable HTTPS. WebSockets work through Coolify's Traefik proxy out of the box; the client uses `wss://` automatically on HTTPS.
6. Deploy. Health check endpoint: `GET /health`.

Notes:
- Game state lives in memory. Restarting the container ends active games. Keep replicas at 1.
- Empty rooms are garbage-collected after 6 hours.
