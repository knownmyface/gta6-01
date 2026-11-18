[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/knownmyface/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/knownmyface/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# CORAL HEAT v2 — 12 story missions, 4 weapons, taxi fares, Coral Coins, 5-star police, helicopter chases, radio & saves in a sunset marina city

An original 3D open-world crime game for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01).
You are **Mara Voss**, a courier in **Coral Bay** — a sunset marina city of palms,
beachfront, boats and a Ferris wheel — running twelve fares for Dutch Calloway
while the Coral Bay Police, their roadblocks and their helicopter try to stop you.

## What is in the game

- **A city to explore on foot and by car** — grid streets, the Coral Strip beachfront,
  the Marina pier with boats, the Coral Wheel Ferris wheel, Old Town, Palm Heights,
  the Docks and Sunset Point, all at golden hour. Buildings wear textured facades
  with lit windows, ground-floor shops with awnings and neon signs, billboards,
  traffic lights, street lamps, benches, bus stops and beach umbrellas.
- **Traffic and pedestrians** — cars loop the road grid (sedans, taxis, vans,
  trucks, sports cars and city buses, each with a visible driver), walkers fill
  the sidewalks and flee gunfire.
- **Stealable cars** — walk up to any traffic car, press **E**, and it is yours
  (the driver runs, the cops notice).
- **Weapons** — a pistol, SMG, rifle and shotgun with real silhouettes: a
  first-person viewmodel with bob, sway, recoil and muzzle flash, the gun in
  Mara's hand in third person, ammo and reloads in the HUD. Buy the bigger guns
  at the GUNSMITH on the Strip (green marker, press **E**).
- **Side activities** — drive a taxi and pick up fares for cash, and hunt the
  12 hidden Coral Coins around the city ($150 each).
- **Wanted level, 1–5 stars** — police pursuit cars ram you, a helicopter circles
  overhead with a searchlight at 3+ stars, roadblocks manned by armed foot
  officers appear ahead at 3–4 stars.
- **12 story missions** — drive, steal-and-deliver, checkpoints, on-foot pickups,
  a shootout, timed runs, tailing a runner, and a 5-star finale escape.
- **Combat** — four weapons on foot, rivals who shoot back with visible rifles,
  police fire, health and getting busted (bail, then back on the street).
- **HUD with a circular minimap** — mission panel, cash, wanted stars, objective
  banner, big speedometer, radio, health.
- **Radio** — three procedural synth stations (Coral FM, Heatwave 88, Marina Nights),
  plus engine hum, sirens, gunshots and mission jingles — all synthesized, no audio files.
- **Start screen and saves** — progress, cash, weapons, coins and missions persist
  in localStorage.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Drive / walk |
| Space | Brake |
| Shift | Boost (car) / run (on foot) |
| E | Steal a nearby car / open the GUNSMITH |
| F | Enter / exit car |
| Mouse click | Shoot (on foot, hold to fire) — drag to look around |
| 1 2 3 4 | Pistol / SMG / rifle / shotgun |
| R | Reload |
| T / 1 2 3 | Radio station (T cycles) |
| M | Mute |
| Esc | Pause |

## Play it

Serve `game/` with any static server and open `game/index.html` in desktop Chrome:

```sh
node serve.ts   # serves game/ on http://localhost:8080
```

No build step, no network requests — every script, image and sound is a file
under `game/` or generated at runtime. three.js is vendored under
`game/vendor/three/three.module.min.js`.

## Screenshots

Four real renders of the game itself, in `screenshots/` (cover first):

1. `1-chase.jpg` — 5-star chase down a Downtown avenue into the sunset: sports car,
   three police cars, helicopter, roadblock ahead, dense HUD
2. `2-foot.jpg` — the carjacking: Mara on foot beside the red Comet GT, pistol in hand,
   muzzle flash
3. `3-marina.jpg` — beachfront drive past the Coral Wheel and the boats
4. `4-mission.jpg` — Mission 5, Loud Night: the shootout at the Docks, rifle viewmodel
   and muzzle flash

## License

MIT — see [LICENSE](LICENSE). All city, character, vehicle, story, art and
sound names are original; nothing is taken from any commercial game.
