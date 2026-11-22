[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/knownmyface/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/knownmyface/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

🔗 [View the bounty on make.fun](https://make.fun/bounty/gta6-01)

# CORAL HEAT

A 3D WebGL open-world crime game set in a sunset coastal marina city. Built with three.js, CORAL HEAT drops you into a neon-drenched waterfront playground where the ocean glows pink, the streets are packed with cars worth stealing, and the police are always one bad decision away.

Drive fast, run jobs, outrun the law, and work your way up from a nobody with a stolen sedan to the crew that pulls off the biggest casino heist the city has ever seen.

## What it is

- **Open-world marina city** — a living 3D coastal map with roads, docks, boats, a casino strip, and a skyline that burns orange at sunset.
- **22 story missions** — a full campaign arc, from your first getaway to the casino-heist finale chain, capped off with a boat getaway across the bay.
- **Stealable cars** — jack anything on the road and make it yours.
- **Wanted system** — cause chaos and the heat rises: patrol cars, roadblocks, and eventually a police helicopter hunting you from above.
- **Street races** — prove yourself against the city's fastest drivers for cash and reputation.
- **Motorcycles & boats** — weave through traffic on two wheels or escape across the water when the roads are closed.
- **Shops & garage** — spend your earnings on gear and keep your favourite rides tuned and ready.
- **3 safehouses** — lay low, stash your cars, and save your progress.
- **Radio** — cruise the coast with the soundtrack on.
- **Saves via localStorage** — your progress, money, and garage persist between sessions.

## How to play

### On foot

Explore the city on foot, scope out targets, and get close enough to a car to take it. On foot you're free to move anywhere — but you're also exposed, so keep an eye on the wanted stars.

### By car

Once you're behind the wheel, the city is yours. Speed through traffic, drift the marina roads, lose the cops in the backstreets, or ram through a roadblock if you're feeling brave. Park in your garage to keep a car for good.

### Wanted level & police

Every crime raises your wanted level. At low heat, a patrol car or two will give chase. Push it further and the response escalates — more units, tighter roadblocks, and a helicopter circling overhead. Break line of sight, hide, or reach a safehouse to cool off.

### Missions

Follow the story markers to take on jobs: getaways, deliveries, hits, and races. The campaign builds toward the casino-heist finale — a multi-part chain of setup jobs, the heist itself, and a boat getaway under full police pursuit. Complete missions to unlock more of the map, better cars, and bigger payouts.

### Street races

Challenge rival drivers at race markers around the city. Win for cash and street cred — lose, and you're just another face in the rear-view mirror.

### Safehouses, shops & garage

Buy gear at shops, tune and store your rides in the garage, and use any of the 3 safehouses to save and shake the heat. Your garage and progress are saved automatically to localStorage.

## Controls

| Action | Key / Input |
| --- | --- |
| Move / drive | `W` `A` `S` `D` |
| Enter / exit car | `E` |
| Carjack | `F` |
| Camera | Mouse |
| Weapon wheel | `Q` (hold) / scroll to switch, click to fire |
| Sprint | `Shift` |
| Handbrake / drift | `Space` |
| Horn | `H` |
| Radio next station | `R` |
| Pause / menu | `Esc` |
| Interact / accept | `Enter` |

> Controls are shown in-game too — press `Esc` at any time to see the full list.

## How to run it

### Option 1 — open it directly

Open `game/index.html` in a modern browser (Chrome, Edge, or Firefox). No build step, no install.

### Option 2 — static server (recommended)

From the project root:

```bash
npx serve .
```

or with Python:

```bash
python3 -m http.server
```

Then open `http://localhost:8000/game/` (or the port shown) in your browser.

## Screenshots

| Screenshot | What it shows |
| --- | --- |
| `1-chase.jpg` | Dense neon casino chase — 116 MPH, 5-star wanted, helicopter + roadblock + explosion |
| `2-foot.jpg` | On-foot carjacking on the boulevard — Rin about to take a Marina GT |
| `3-marina.jpg` | Boat getaway — speedboat underway with police boats closing in |
| `4-race.jpg` | Street race — Midnight Strip circuit, lap and position on the HUD |

## Tech

- [three.js](https://threejs.org/) — WebGL rendering, lighting, and the sunset coastal atmosphere
- Plain HTML / CSS / JavaScript — no build step, runs anywhere a modern browser does
- `localStorage` — saves, garage, and mission progress

## License

MIT — free to use, modify, and share. See `LICENSE` for the full text.
