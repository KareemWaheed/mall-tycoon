# Handoff: where we are and what's next

This file is for the next Claude Code session (running locally on the owner's machine).
Read it together with `README.md` and `docs/DESIGN.md`.

## The project in one paragraph
Mall Tycoon is a phone idle-arcade game (carry-and-stack genre) inspired by the
"Supermarket Tycoon: Empire" ads: you carry stock from a stock room to display tables,
check shoppers out at a till, collect the trolleys they leave lying about (pushed as a nested
train), and stand on floor price tiles to buy upgrades and staff. It starts as one sneaker shop
and the plan is to grow it into a whole mall, with shopper tiers (popular / middle / niche /
high-end) whose mix depends on the mall's prestige. Built with Vite + TypeScript + three.js as a PWA.
Sister project: `KareemWaheed/ezba` (a farm game in the same genre, same architecture); code was
borrowed from it where useful (joystick, audio, instanced stacks, sim/render split, pacing simulator).

## Status (commit a83190d on `main`)
Working and playable:
- Full loop for shop 1 (sneakers): stock pallets, 6 tables in 3 product lines, till with a queue,
  trolleys (a trolley means a bigger basket, so collecting them matters), 12 upgrade tiles,
  hired cashier / stocker / trolley worker, tutorial hints + floor arrow, save to localStorage.
- Three shopper tiers with different looks and behaviour (`src/config/game.ts` TIERS).
- Pure, seeded sim in `src/sim/` (no three.js / DOM). `npm run simulate -- --check` runs a bot through
  the shop: everything bought in ~36-38 min, 0-3% angry shoppers, trolleys never lost. It runs as part
  of `npm run build`, so balance regressions fail the build.
- Debug URL params: `?fresh ?bot ?warp=600 ?speed=4 ?money=1000 ?at=x,z ?zoom=2`.

## The owner's verdict on the visuals: NOT acceptable
Their words (Egyptian Arabic, translated): "It looks really bad. The people look worse than Lego,
nothing like the ad. The sneakers look awful."
Cause: every model is built in code from primitives (`src/render/models.ts`, `src/render/character.ts`).
That approach cannot reach the ad's quality. **The next task is replacing the art with real 3D assets.**
The previous (cloud) session could not do it because asset sites were blocked there; locally they aren't.

## Decisions already made
- **Real brands are fine** (personal project): Nike, Jordan, Adidas, New Balance, Puma... with real
  logos on shoes, signs, boxes and tables. Replace the made-up "KOTSHY" store brand and the
  STREET / RUNNER / LIMITED product names with real brands/models (e.g. a Nike store first,
  or a multi-brand sneaker shop; ask the owner if unsure).
- Keep the game design, the sim and the balance as they are. This is a **render-layer swap**:
  `src/sim/` and `src/config/game.ts` should barely change.
- Mobile first: it must stay smooth on a mid-range phone with ~18 shoppers + staff on screen.

## Plan for the art swap
1. **Characters**: rigged humans with animations Idle, Walk, Walk-while-carrying, Push (trolley),
   Cheer, Angry (and Sit for later). Source: Mixamo (needs the owner's Adobe login, so the owner may have
   to download the FBX files by hand; ask them to put them in `assets-src/`). Convert FBX -> GLB
   (FBX2glTF or Blender), share one skeleton so every animation works on every character
   (`SkeletonUtils.clone`, one `AnimationMixer` per character, retarget if skeletons differ).
   Need visible variety per tier: casual, galabeya / abaya + hijab for the popular tier, suits for
   high-end later. Material/colour swaps on shared meshes are fine for variety.
2. **Sneakers**: real-looking low-poly sneaker models (Sketchfab, free + downloadable, GLB), one per
   product line, with brand logos. Fallback that is known to work: KhronosGroup glTF-Sample-Assets
   `Models/MaterialsVariantsShoe` (a real sneaker with colour variants; ~8 MB, must be compressed).
3. **Props**: shopping trolley, display tables, checkout counter with register, shoe boxes, wall shelves,
   plants. Sketchfab / Kenney / Quaternius / poly.pizza.
4. **Compress everything** with `@gltf-transform/cli` (meshopt or draco geometry, textures resized to
   512-1024 and converted to webp/ktx2). Target: under ~5 MB of assets total. Load with GLTFLoader +
   MeshoptDecoder, show the existing loading screen until ready, and keep the procedural models as a
   fallback if a file fails to load.
5. **Keep instancing** for repeated items (pairs on tables, boxes on pallets, bills): one InstancedMesh per
   product geometry, as `src/render/stacks.ts` does today.
6. Re-check the look against the ad screenshots: warm wood floor, clean grey walls with coloured trim,
   bright saturated products, soft shadows, slightly tilted top-down camera.

## How to check your work
- `npm run dev`, then look at it. The cloud session took screenshots with Playwright + Chromium
  (portrait 390x844 @2x) using `?fresh&warp=900` to get a busy store, and `?zoom=0.45&at=x,z` for close-ups.
- `npm run build` must pass (typecheck + pacing check + vite build).

## Working with the owner
- They write in Egyptian Arabic; answer in Egyptian Arabic. Code, comments and commits in English.
- They care most about it looking like the ads. Show screenshots before calling something done.
- Deploy: GitHub Pages via `.github/workflows/deploy.yml` (needs Settings -> Pages -> Source: GitHub Actions,
  once). For testing on the phone, `npm run host` and open the LAN URL.
