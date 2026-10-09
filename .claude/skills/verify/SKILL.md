---
name: verify
description: Cheap verification of a Tower Guard change - quiet type-check and tests, then (for visual changes) one targeted look at the running game. Use before finishing any change.
---

# Verify

1. `npm run -s verify` — one line when all is well, otherwise only the errors. Fix and rerun.
2. Stop here unless the change is visible (drawing, UI, animation, gameplay feel).
3. Start the dev server with `preview_start {name: "dev"}` (reuses a running one). Open a **new background tab**, never
   the user's game tab.
4. Go straight to the view that shows the change, no clicking through menus:
   - animation: `?lab=<id>` (ids in `src/scenes/labRows.ts`)
   - a look: `?designs=<id>`
   - gameplay: `?debug`, then set up the case from the console via `window.__towerGuard.scene`
     (e.g. spawn, damage, `players[1].input.set(...)`).
5. Check state with `javascript_tool` (numbers, positions, counts) and the console for errors. Take **one** screenshot
   at `scale: 0.5` only if the look itself must be judged.
6. If judging it needs several screenshots or a sequence (timing, motion), hand it to a subagent with the URL and what
   to look for, and keep only its verdict.
7. Close the tab you opened.
