# CORAL HEAT — 12 story missions, 5-star police, helicopter chases, carjacking, boats & radio in a sunset marina city

[![make.fun](https://make.fun/badge/competition/gta6-01)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge/entry/gta6-01)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge/play/gta6-01)](https://make.fun/bounty/gta6-01)

An entry for the [make.fun **Make GTA 6** bounty](https://make.fun/bounty/gta6-01):
a complete original open-world crime game that runs offline in a desktop browser
from static files. Sunset over Coral Bay — drive, steal, sail, and outrun the
whole Coral Bay PD.

## The game

Kai Solano is back in Coral Bay with a dead scooter and a $20,000 debt to Marta
Reyes. Twelve story missions take him from first light to the final heat wave:
carjackings, a taxi fare, a shootout on Palm Row, a 5-star helicopter chase —
and two jobs on the water, stealing boats out of the marina and running cargo
past harbor patrol.

- **A city to explore on foot and by car** — Downtown, Palm Row, Sunset Strip,
  Old Coral, Harbor Heights, the Beachfront and the Marina District, with
  traffic, pedestrians, palms, a Ferris wheel and Coral Plaza.
- **Drivable boats + a marina** — speedboats, a yacht and skiffs moored at the
  docks, harbor patrol boats that hunt you on the water, wakes and bob.
- **On-foot carjacking** — a visible sequence: walk up, yank the door, drag the
  driver out, slide in and go. The driver stumbles away.
- **Wanted system** — 0–5 stars, PD cruisers that ram, roadblocks at 4 stars,
  the Air One helicopter with a searchlight at 3+.
- **Combat** — three weapons (P9 pistol, Stinger SMG, Boomstick 12) with HUD
  slots, ammo, tracers and muzzle flash.
- **Dense legible HUD** — mission panel, cash, wanted stars, health + vehicle
  damage bars, circular minimap, big speedometer, radio station, weapon slots
  and objective banner.
- **Radio** — three synthesized stations (Sunset FM, Reef Radio, Bay Talk),
  engine hum, sirens, gunshots and splashes. All sound is made live in the
  browser; nothing is downloaded.
- **Side activities** — Tiko's garage (tuning, armor, repairs), Amara's gun
  shop, and 12 coral tokens hidden around the city.
- **Save** — progress, cash, weapons and stats persist in the browser.

Everything is original: the city, characters, vehicles, story, art and music.
No Rockstar content of any kind.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

| Key | Action |
| --- | --- |
| W A S D | Move / drive / sail |
| Mouse | Look / aim (click to lock) |
| E | Enter car · carjack · board boat · shop |
| Click | Shoot |
| 1 / 2 / 3 | Weapons |
| R | Change radio station |
| Shift | Sprint / boost |
| Space | Brake / handbrake |
| H | Honk |
| P | Pause & save |

## Screenshots

Four real renders of the game (`screenshots/`): the Palm Row chase cover, the
carjacking on Sunset Strip, the marina, and the "Smoke on the Water" boat
mission. Staged with `?shot=chase|foot|marina|mission` — every car, boat and
star in each still is a live object in the running game.

## Tech

- `three.js` r187, vendored under `game/vendor/three/`
- Static files under `game/`, no build step, no network requests
- `main.ts` (Node 22) copies `game/` + `screenshots/` to `/output` and writes
  `dossier.json` with the vendored make.fun library
- MIT license — see `LICENSE`
