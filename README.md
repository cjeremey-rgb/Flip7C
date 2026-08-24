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

## Presentation theme

The default presentation is **Neon Circuit** in the startup screen, single-player, and multiplayer. Seasonal variants remain in the code and can be previewed by adding `?theme=seasonal` (automatic by date) or `?theme=spring`, `summer`, `autumn`, `winter`, or `christmas` to a page URL.

## Latest presentation update

- Number cards now use a distinct neon color palette instead of beige faces.
- Multiplayer reactions (🔥 😅 😈 👏 🤯) are sent through the server and displayed to every player at the table.


## Multiplayer quick phrases
Use the reaction button during a multiplayer game and tap the speech-bubble option to send a premade phrase to everyone. Players named Becca also receive the additional phrase "You're a peckerhead!".

## Install as a phone app (PWA)

This repository is now an installable Progressive Web App while keeping the existing game UI unchanged.

- Deploy the complete repository to an HTTPS Node host as before.
- Android/Chrome: open the deployed Flip Rush 7 URL, then choose **Install app** from the browser menu (or accept the browser's install prompt).
- iPhone/iPad/Safari: open the deployed URL, use **Share → Add to Home Screen**.
- The installed app launches at the existing Single Player / Multiplayer startup screen.
- Static game files use a network-first service worker, so new website versions are fetched whenever possible while the last successful build remains available as an offline fallback.
- Multiplayer API calls are never cached and still require an internet connection.

The service worker is intentionally invisible; it does not alter the game's visuals.
