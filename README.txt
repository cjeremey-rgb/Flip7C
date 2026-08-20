FLIP RUSH 7 - OFFICIAL RULES MULTIPLAYER PATCH

This patch changes gameplay logic only. It deliberately does NOT include or replace online.css, index.html, manifest files, icons, images, or other visual assets.

Replace these files in your existing multiplayer project:
1. server.js -> project root/server.js
2. public/online.js -> project root/public/online.js
3. public/online.html -> project root/public/online.html

Keep all of your existing visual/style files exactly as they are, especially public/online.css.
Restart the Node server after replacing the files.

Rules corrected:
- Maximum one Second Chance per player.
- An extra Second Chance must be given to another active player without one; discard only if nobody is eligible.
- Second Chance protects only against duplicate Number cards and does not block Freeze.
- Freeze and Flip Three may target any active player, including the drawer.
- Flip Three timing follows the three-card sequence, with Second Chance immediate and other Action cards queued.
- A tied high score at or above 200 sends everyone into another full round.
- Multiplayer table size is 3-9 players.
- The draw pile/discard pile persists correctly across rounds and reshuffles only when the draw pile is exhausted.

Generated 2026-08-19.
