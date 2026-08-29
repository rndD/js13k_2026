# Technicolor Tilt

> [!IMPORTANT]
> This is a work-in-progress JS13KGames 2026 entry by [@rndD](https://github.com/rndD).

## Description

Technicolor Tilt is a pinball boss rush built to fit within 13kb.

Launch balls, keep them alive with the flippers, break boss armor, and combine red and blue power to turn your attacks rainbow. Defeat five increasingly dangerous bosses and choose upgrades between battles to shape each run.

Hold a flipper as a main ball approaches to catch it, aim a precision shot, and release it toward the boss. Temporary balls keep fighting on their own but cannot be aimed.

**Controls**

Touch devices:

* Hold the upper-right launch zone, then release to launch a ball.
* Press the bottom-left and bottom-right zones to use the flippers.
* Hold a flipper to catch and aim a main ball; release to shoot.
* Tap an upgrade card to select it.

Desktop:

* `↑` — hold and release to launch
* `←` / `→` — flippers; hold to catch and aim a main ball
* `1` / `2` / `3` — select an upgrade card

## Build with

* [TypeScript](https://www.typescriptlang.org/)
* [Vite](https://vite.dev/)
* [Roadroller](https://github.com/lifthrasiir/roadroller)
* [Terser](https://terser.org/)
* [Vitest](https://vitest.dev/)

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Run the tests and create the 13kb archive:

```bash
npm test
npm run build
```

The packaged game is written to `dist/game.zip`.

## Credits

Thanks:

* [js13kGames](https://js13kgames.com/) for the competition
* [Frank Force](https://github.com/KilledByAPixel) for [ZzFX](https://github.com/KilledByAPixel/ZzFX)
* [Xem](https://github.com/xem) — custom physics inspired by [mini2Dphysics](https://github.com/xem/mini2Dphysics)
