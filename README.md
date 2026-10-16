# مول تايكون (Mall Tycoon)

An idle-arcade mall builder for phones (carry-and-stack genre), built as a PWA with Vite, TypeScript and three.js.
You start with one sneaker shop, **كوتشي (KOTSHY)**, and grow it into a whole mall.
Design notes and the roadmap are in [docs/DESIGN.md](docs/DESIGN.md); all balance numbers are in `src/config/game.ts`.

## Run locally
```sh
npm install
npm run dev          # http://localhost:5173  (WASD / arrows on desktop, drag anywhere on a phone)
npm run host         # same, reachable from a phone on the same Wi-Fi
```

## Deploy
Every push to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`
(one-time setup: repo Settings → Pages → Source: **GitHub Actions**). URL: https://kareemwaheed.github.io/mall-tycoon/

## Scripts
- `npm run build`: type-check, pacing check, production build into `dist/`
- `npm run simulate -- --minutes 40 --seed 2 [--check]`: a headless bot plays the store and prints when each
  upgrade gets bought, income per minute, angry shoppers and trolley counts. `--check` fails on a pacing regression.

## Debug URL params
`?fresh` (ignore the save) · `?bot` (autopilot) · `?warp=600` (fast-forward 600 s with the autopilot before showing)
· `?speed=4` · `?money=1000` · `?at=x,z` (teleport) · `?zoom=2` (camera further out). `game.reset()` in the console wipes the save.

## Code layout
- `src/config/game.ts`: products, shopper tiers, layout, upgrade tiles and tuning
- `src/sim/`: pure game logic (no three.js / DOM, seeded RNG), shared by the game and the simulator
- `src/render/`: three.js views that mirror sim state; every model is built in code (no asset files)
- `src/ui/`: HUD and joystick
