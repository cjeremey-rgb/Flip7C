# Flip Rush 7

This is the restored full game package.

## Files
All game files live at the project root. There is **no `public` folder**.

- `index.html` — original-style mode selection home screen
- `offline.html` / `offline.js` — single-player game
- `online.html` / `online.js` — multiplayer game
- `online.css` — shared game styling
- `server.js` — multiplayer server
- `manifest.json`
- `package.json`

## Run multiplayer
Requires Node.js 18+.

```bash
npm start
```

Then open:

`http://localhost:3000`

## Requested changes preserved
- Home screen still lets you choose Single Player or Multiplayer.
- Existing visual/game shell restored instead of the stripped-down rebuild.
- Maximum one Second Chance per player.
- Extra Second Chance must be given to another active player without one; discard only if nobody is eligible.
- Second Chance does not block Freeze.
- Freeze may target any active player, including the drawer.
- Multiplayer uses the official 3–9 player limit.
- A tie for highest score at/above 200 triggers another full round.
- Multiplayer reactions are server-synchronized.
- Existing emoji reactions remain.
- Preset phrases flash for all players with the sender's name:
  - You suck!
  - You're a peckerhead!
  - You got lucky!
  - So close
  - Tough Break!
