# Flip Rush 7 — Flat GitHub Repository

All game files are intentionally stored directly in this repository root. There are no nested `public`, `multiplayer`, or `single-player` folders.

## Files

- `server.js` — multiplayer Node server and game rules engine
- `package.json` — Node project configuration
- `index.html` — startup screen with Single Player and Multiplayer mode selection
- `online.html` — multiplayer interface
- `online.js` — multiplayer browser logic
- `online.css` — approved multiplayer styling
- `offline.html` — approved single-player game used by the multiplayer interface's Single Player button
- `Flip-Rush-7-Single-Player.html` — standalone copy of the approved single-player game
- `manifest.json` — web app manifest
- `.gitignore` — Git exclusions

## Run multiplayer locally

```bash
npm start
```

Then open `http://localhost:3000`.

For Render or another Node host, use `npm start` as the start command and keep all of these files in the repository root.

## Rules corrections included

- A player may hold only one Second Chance.
- An extra Second Chance must be given to another active player without one; it is discarded only when no eligible recipient exists.
- Second Chance protects only against duplicate Number cards and does not block Freeze.
- Freeze and Flip Three may target any active player, including the drawer.
- Flip Three resolves three cards unless the target busts or reaches Flip 7; Second Chance resolves immediately while other Action cards wait until the sequence finishes.
- Seven unique Number cards end the round immediately and award +15.
- x2 doubles only the Number-card subtotal; additive modifiers and the Flip 7 bonus are added afterward.
- Multiplayer supports 3–9 players.
- A tie for the highest score at or above 200 continues into another full round until there is one leader.

No intended visual redesign is included in this release.
