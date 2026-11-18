[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/knownmyface/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/knownmyface/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# CORAL HEAT — 12 story missions, 5-star police, helicopter chases, radio & saves in a sunset marina city

An original 3D open-world crime game for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01).
You are **Mara Voss**, a courier in **Coral Bay** — a sunset marina city of palms,
beachfront, boats and a Ferris wheel — running twelve fares for Dutch Calloway
while the Coral Bay Police, their roadblocks and their helicopter try to stop you.

## What is in the game

- **A city to explore on foot and by car** — grid streets, the Coral Strip beachfront,
  the Marina pier with boats, the Coral Wheel Ferris wheel, Old Town, Palm Heights,
  the Docks and Sunset Point, all at golden hour.
- **Traffic and pedestrians** — cars loop the road grid, walkers fill the sidewalks
  and flee gunfire.
- **Stealable cars** — walk up to any traffic car, press **E**, and it is yours
  (the driver runs, the cops notice).
- **Wanted level, 1–5 stars** — police pursuit cars ram you, a helicopter circles
  overhead with a searchlight at 3+ stars, roadblocks appear ahead at 3–4 stars.
- **12 story missions** — drive, steal-and-deliver, checkpoints, on-foot pickups,
  a shootout, timed runs, tailing a runner, and a 5-star finale escape.
- **Combat** — pistol on foot, rivals who shoot back, police fire, health and
  getting busted (bail, then back on the street).
- **HUD with a circular minimap** — mission panel, cash, wanted stars, objective
  banner, big speedometer, radio, health.
- **Radio** — three procedural synth stations (Coral FM, Heatwave 88, Marina Nights),
  plus engine hum, sirens, gunshots and mission jingles — all synthesized, no audio files.
- **Start screen and saves** — progress, cash and missions persist in localStorage.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Drive / walk |
| Space | Brake |
| Shift | Boost (car) / run (on foot) |
| E | Steal a nearby car |
| F | Enter / exit car |
| Mouse click | Shoot (on foot) — drag to look around |
| R / 1 2 3 | Radio station |
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

1. `1-chase.jpg` — 5-star chase down Coral Strip: sports car, two police cars, helicopter, roadblock ahead
2. `2-foot.jpg` — the carjacking: Mara on foot beside the red Comet GT
3. `3-marina.jpg` — beachfront drive past the Coral Wheel and the boats
4. `4-mission.jpg` — Mission 5, Loud Night: the shootout at the Docks

## License

MIT — see [LICENSE](LICENSE). All city, character, vehicle, story, art and
sound names are original; nothing is taken from any commercial game.
