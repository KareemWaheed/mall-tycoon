# Mall Tycoon: design notes

Inspired by the "Supermarket Tycoon" style ads (carry-and-stack, floor price tiles, trolley trains), with our own
twist: one shop grows into a mall, and who walks in depends on how good the mall is.

## Core loop (shop 1: كوتشي, sneakers)
- **Stock room**: pallets of shoe boxes refill on their own (`restock` speeds it up). Stand at a pile to pick up.
  Pickup is capped at the free space on that product's tables, and surplus in your hands goes back on the pile,
  so you can never get stuck holding something you can't place.
- **Tables**: stand next to one to lay pairs out (4 x 3). Shoppers take pairs off the tables themselves.
- **Till**: shoppers queue holding their pairs (or with them in a trolley). Stand behind the counter to scan;
  the player is much faster than a hired cashier, and only the player earns tips. Money piles up on the green mat.
- **Trolleys**: a shopper with a trolley buys 2-4 pairs instead of 1. Most leave the trolley lying about (inside
  or on the plaza). Walk into them to push a nested train (hands must be empty), park it at the rail.
  No trolleys on the rail = smaller baskets, so collecting them is an economic decision, not a chore for its own sake.
- **Floor tiles**: stand still on one to pay into it. One tile per upgrade track, levels advance in place.

## Shopper tiers
| tier | look | buys | behaviour |
|---|---|---|---|
| شعبي | galabeya, abaya + hijab, tracksuits | STREET (red) | most likely to take a trolley, patient, no tips |
| متوسط | tees, polos, jeans, caps, some hijab | STREET / RUNNER | half take trolleys, small tips |
| niche | black / beige, beanies, glasses, tote bags | LIMITED (purple) | never use trolleys, impatient, big tips |
| هاي إند (planned) | suits, sunglasses, driver, bodyguard | luxury wing | personal service, VIP lounge, hates crowds and mess |

## Architecture
- `src/sim/` is pure TypeScript with a seeded RNG; `World.tick(dt, input)` advances everything.
  The browser and `tools/simulate.ts` run the same code.
- Shoppers and staff walk on a 0.5 m grid with A* and line-of-sight smoothing (`sim/nav.ts`), rebuilt when tables open.
- `src/render/` reads sim state; events (`world.events`) drive sounds, flying boxes/bills, confetti and toasts.
- Models are vertex-colored primitives merged per model (one draw call each, shared material);
  tables, piles and the cash stack are InstancedMeshes.
- Look: Neutral tone mapping, a sun with shadows that follows the camera, a soft room environment map,
  canvas-drawn wood floor / paving / signs. The front and west walls are low with glass above so nothing hides the floor.

## Pacing (bot, `npm run simulate`)
First table ~0:30, cashier ~9 min, everything in shop 1 bought at ~36-38 min, 0-3% angry shoppers.

## Roadmap
1. **Shop 1 polish**: offline earnings, a delivery van at the back door instead of self-refilling pallets,
   haptics, a settings sheet, a "store rating".
2. **Mall prestige**: floor/lighting/decor upgrades and cleanliness (trolleys lying about, queues) raise prestige;
   prestige decides the tier mix walking in.
3. **More shops** (the shuttered units next door): clothes (هدوم), electronics, a supermarket, a café in the middle.
   Shared plaza, trolleys and checkout staff across shops.
4. **Niche wing**: limited sneaker drops with a queue outside before opening.
5. **High-end floor**: its own entrance and till, VIP lounge, fitting room, staff carrying bags to the car.
6. Events: shoplifter chase, sale days / Black Friday rush, celebrity visit (ezba's scenario system is a good base).
