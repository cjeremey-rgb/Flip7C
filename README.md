# Flip Rush 7 — GitHub-ready full files

This package contains complete replacement source files, not a patch.

## Single player

`single-player/Flip-Rush-7-Single-Player.html`

This is a standalone HTML file. It keeps the approved polished visual presentation and includes the corrected rules logic.

## Multiplayer

Upload the contents of the `multiplayer` folder as the multiplayer app/repository root.

Required layout:

- `server.js`
- `package.json`
- `public/index.html`
- `public/online.html`
- `public/online.js`
- `public/online.css`
- `public/offline.html`
- `public/manifest.json`

Run locally with:

```bash
npm start
```

Then open `http://localhost:3000`.

For Render or another Node host, use `npm start` as the start command.

## Rules corrections included

- A player may hold only one Second Chance.
- An extra Second Chance must be given to another active player without one; discard it only when no eligible recipient exists.
- Second Chance protects only against duplicate Number cards and does not block Freeze.
- Freeze and Flip Three may target any active player, including the drawer.
- Flip Three resolves three cards unless the target busts or reaches Flip 7; Second Chance resolves immediately while other Action cards wait until the sequence finishes.
- Seven unique Number cards end the round immediately and award +15.
- x2 doubles only the Number-card subtotal; additive modifiers and the Flip 7 bonus are added afterward.
- Multiplayer supports 3–9 players.
- A tie for the highest score at or above 200 continues into another full round until there is one leader.

No intended visual redesign is included in this release.
