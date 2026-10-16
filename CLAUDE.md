# Mall Tycoon

Start every session by reading `docs/HANDOFF.md` (current status, the owner's feedback, the next task),
then `README.md` and `docs/DESIGN.md`.

- `src/sim/` is pure logic (no three.js / DOM, seeded RNG); keep it that way. Balance lives in `src/config/game.ts`.
- `npm run build` (typecheck + `tools/simulate.ts --check` + vite build) must pass before pushing.
- The owner writes in Egyptian Arabic: reply in Egyptian Arabic. Code, comments and commits in English.
