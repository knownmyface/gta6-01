[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/knownmyface/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/knownmyface/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# CORAL HEAT v2.4 — a sunset marina city crime game: 12 story missions, 4 weapons, taxi fares, Coral Coins, 5-star police, helicopter chases, radio & saves

An original 3D open-world crime game built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01).
You are **Mara Voss**, a courier working the streets of **Coral Bay** — palms,
beachfront, boats and a Ferris wheel at golden hour — running twelve fares for
Dutch Calloway while the Coral Bay Police, their roadblocks and their
helicopter try to stop you.

v2.4 rewrites v2.3's code from scratch for the make.fun transcript gate
(30%+ authored lines). The game is unchanged — the same missions, the same
city, the same screenshots — only the code is new. City layout, traffic,
pedestrians, missions, weapons, fares and coins all behave exactly as before;
the seeded rng streams were checked identical against v2.3 before the retake.

v2.1 fixed the three things the v2 screenshots showed were wrong: the police
helicopter is now police-white with a flashing light bar, so it reads against
the sunset (it used to be dark navy and hid behind the towers); glass towers
now wear a dense lit-window grid with rooftop crowns, fins and neon signs
(the flat mint slab is gone); and the rifle viewmodel points down-range with
a camera fill light and a live muzzle flash (no more dark blob).

## Inside the game

- **A city to explore on foot and by car** — a grid of streets, the Coral Strip
  beachfront, the Marina pier with its boats, the Coral Wheel Ferris wheel, Old
  Town, Palm Heights, the Docks and Sunset Point, all at golden hour. Buildings
  have textured facades with lit windows, ground-floor shops with awnings and
  neon signs, billboards, traffic lights, street lamps, benches, bus stops and
  beach umbrellas.
- **Traffic and pedestrians** — cars loop the road grid (sedans, taxis, vans,
  trucks, sports cars and city buses, each with a visible driver), while walkers
  fill the sidewalks and flee gunfire.
- **Stealable cars** — walk up to any traffic car, press **E**, and it is yours.
  The driver runs; the cops notice.
- **Weapons** — a pistol, SMG, rifle and shotgun, each with a real silhouette:
  a first-person viewmodel with bob, sway, recoil and muzzle flash, the gun in
  Mara's hand in third person, and ammo plus reloads in the HUD. Buy the bigger
  guns at the GUNSMITH on the Strip (green marker, press **E**).
- **Side activities** — drive a taxi and pick up fares for cash, and hunt the
  12 hidden Coral Coins around the city ($150 each).
- **Wanted level, 1–5 stars** — police pursuit cars ram you, a helicopter circles
  overhead with a searchlight at 3+ stars, and roadblocks manned by armed foot
  officers appear ahead at 3–4 stars.
- **12 story missions** — driving, steal-and-deliver, checkpoints, on-foot pickups,
  a shootout, timed runs, tailing a runner, and a 5-star finale escape.
- **Combat** — four weapons on foot, rivals who shoot back with visible rifles,
  police fire, health, and getting busted (pay bail, back on the street).
- **HUD with a circular minimap** — mission panel, cash, wanted stars, objective
  banner, big speedometer, radio, health.
- **Radio** — three procedural synth stations (Coral FM, Heatwave 88, Marina Nights),
  plus engine hum, sirens, gunshots and mission jingles. Everything is
  synthesized; there are no audio files.
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

1. `1-chase.jpg` — a 5-star chase down a Downtown avenue into the sunset: sports car,
   three police cars, a white police helicopter overhead with its searchlight,
   a roadblock ahead, dense HUD
2. `2-foot.jpg` — the carjacking: Mara on foot beside the red Comet GT, pistol in hand,
   muzzle flash
3. `3-marina.jpg` — a beachfront drive past the Coral Wheel and the boats
4. `4-mission.jpg` — Mission 5, Loud Night: the shootout at the Docks, rifle viewmodel
   (barrel, handguard, magazine, stock) and muzzle flash

## License

MIT — see [LICENSE](LICENSE). All city, character, vehicle, story, art and
sound names are original; nothing is taken from any commercial game.
