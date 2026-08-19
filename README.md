# Flip Rush 7 Multiplayer — Rules Fixed

Run with Node.js 18+:

```bash
npm start
```

Then open http://localhost:3000

This build enforces:
- 3–9 players
- maximum one Second Chance per player
- extra Second Chance must be given to another active player without one, otherwise discarded
- Second Chance only blocks duplicate Number cards (not Freeze)
- Freeze may target any active player, including the drawer
- tied high score at/above 200 triggers another complete round
- Flip Three counts all three revealed cards and delays Freeze/Flip Three actions until the sequence finishes
