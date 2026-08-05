# Flip Rush 7 — Checked Dual-Mode Build

## Which HTML files can be opened directly?

- `public/offline.html`: works when opened directly and runs the single-player game.
- `public/index.html`: looks correct when the whole `public` folder stays together.
- `public/online.html`: requires the Node server or a hosted deployment. If opened directly, it now shows an explanation instead of a broken lobby.

## Local online test

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

# Flip Rush 7 — Dual Mode

## Modes
- **Single Player:** current three-player offline game against Nova and Ace.
- **Online Multiplayer:** private room codes for real players on separate devices.

## Run locally
```bash
npm install
npm start
```
Open `http://localhost:3000`.

## Deploy to Render
Create a new **Blueprint** from the GitHub repository. The included `render.yaml` supplies the commands.

## Important
The online server currently keeps active rooms in memory. A room is lost if the host service restarts. The standalone HTML preview can demonstrate the mode selector and play Single Player, but worldwide multiplayer requires the source project to be hosted.
