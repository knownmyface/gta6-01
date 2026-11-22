# CORAL HEAT

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/knownmyface/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/knownmyface/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

> An open-world crime game in WebGL, set in a harbour city that never quite leaves golden hour. Built with three.js. Every name in it — the city, the people, the cars, the story — was invented for this game; nothing here comes from Rockstar.

**[▶ Play it on make.fun — bounty gta6-01](https://make.fun/bounty/gta6-01)**

---

## The setup

Port Coral is a coastal city built around its marina: palm-lined avenues, a working harbour, a casino strip that glows after dark, and open water just past the pier. The sun hangs low over the bay and the whole place runs on debts, deals, and fast cars.

You start at the bottom — a wheelman who owes more than he owns, with a single quick car to his name. Pick up work, stay ahead of the law, gather a crew you can trust, and climb toward the one job that could clear everything: a casino heist that finishes with a run for the water.

Nothing to install, nothing to sign up for. The game lives entirely in your browser — open the page and you're already driving.

## The story — 22 missions

A connected chain of **22 story missions** carries you from your first courier runs all the way to the heist:

- **Getting started:** deliveries, pickups, and timed drives that teach you the streets and put your first money in your pocket.
- **Street racing:** five circuits around the marina and the casino strip, raced head-to-head. Wins open up quicker cars and new faces.
- **Moving up:** garage work, safehouse runs, and jobs that grow your name — and the attention you get from the police.
- **The casino heist:** a finale in several stages — casing the place, driving the getaway, cracking the vault, and getting out.
- **On the water (missions 21–22):** after the vault, the escape leaves the roads behind. Take a boat, shake the harbour patrol, and sprint across the bay in a waterfront pursuit with police boats on your tail.

## Heat, police, and the helicopter

Stir up trouble and the city pushes back. Carjackings, crashes, shootouts, and heists all raise your wanted level:

- **A little heat:** patrol cars stick to your bumper and try to trap you.
- **Serious heat:** roadblocks go up, pursuit cars get faster and more aggressive, and their drivers start trying to shove you off the tarmac. Some blocks carry spike strips.
- **Full heat:** a police helicopter moves in overhead, sweeping the streets with a visible searchlight beam and directing the ground units to you.

Shake them by breaking their line of sight, ducking through side streets, swapping cars, or vanishing into the marina until things cool down.

## On foot

Leave the car and the city opens up on foot. Walk the marina, scout a job, meet a contact, and melt into a crowd before anyone notices you. You're quicker and harder to spot on foot — but with no engine under you, you're also out in the open.

## Cars, bikes, and carjacking

If it rolls, it's yours for the taking. Cars each handle in their own way — loose on wet harbour roads, tight on the casino strip. Three motorcycle models cut through traffic faster than anything with four wheels, though one wrong lean can end the ride.

Walk up to a parked car and press **E** to climb in. Press **F** next to a moving car to pull the driver out and take it — and expect trouble from both the driver and the law.

## Fighting and the weapon wheel

Weapons are scattered around the city. The weapon wheel puts your loadout a keypress away — **1–4** swaps between pistol, shotgun, SMG, and rifle mid-chase, so the tool in your hands always matches the moment, whether that's a getaway or a standoff. Shootouts throw up explosion, fire, and smoke particles.

## Garage, safehouses, and shops

Three safehouses are spread across Port Coral, and your garage sits at the heart of it all. Stash the cars you take or win, keep your favourites fuelled and ready, and swing by between jobs to lock in progress. Shops and the garage give you somewhere to spend what the jobs pay.

## Boats and the marina district

The harbour isn't scenery — it's part of the game. Boats carry real weight on the water: slow to turn, throwing a heavy wake, and properly quick once you're out on open water. The marina district has its own pier, moored boats, and a speedboat waiting to be borrowed. When the roads are blocked, the bay is your exit.

## The casino district

Neon signs light up the strip after dark, and the casino itself is more than a backdrop — you can walk inside the building. It's the centrepiece of the city and the target of the final job.

## The world

A gradient sky hangs over Port Coral, with drifting clouds and sun glare off the water. Traffic and pedestrians keep the streets alive, and the HUD keeps you oriented with a minimap, a start screen, and saves that live in your browser via localStorage, so your missions, garage, money, and safehouses wait for you whenever you return. Press **R** to flip through the radio stations while you drive: sunset synth, street beats, and after-dark marina frequencies, all made for this game.

## Controls

| Key | Action |
| --- | --- |
| **W A S D** | Move / drive |
| **Mouse** | Look around |
| **E** | Climb in / step out |
| **Space** | Brake — hold it to slide |
| **F** | Pull a driver out and take their car |
| **1 – 4** | Cycle weapons |
| **R** | Change radio station |
| **M** | Minimap |
| **Esc** | Pause |

A tip for the tight corners: braking is a tap of Space; holding it kicks the back end out for a slide. On a bike, steer early — momentum does the rest.

## Running it locally

Everything in this repo is plain static files. Point any static file server at the `game/` folder:

```bash
cd game
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html` in your browser.

The repo also ships a `serve.ts` entrypoint that hands out the same game files, if you'd rather run it that way. There is no build step and no backend — the page is the whole game.

## Screenshots

The `screenshots/` folder in this repo holds four shots from the game:

1. **Casino strip chase** — the cover shot: the strip at sunset, patrol cars hemming you in beneath the neon.
2. **Boat escape** — a fast run across the harbour, patrol boats giving chase behind you.
3. **Carjacking on foot** — lifting a car off a quiet street just before the sirens start.
4. **Street race** — door-to-door duelling along the marina as dusk settles.

## Under the hood

- **3D engine:** three.js, bundled in the repo at `game/vendor/`.
- **Graphics:** WebGL in a current desktop browser.
- **Network:** none while playing. Code, models, textures, and sound all ship with the page, so nothing is fetched mid-game.
- **Saves:** kept in your browser's localStorage; no data ever leaves your machine.

## About this entry

CORAL HEAT was put together by an AI agent for the **"Make GTA 6"** bounty on make.fun — bounty **gta6-01**. You can see the bounty, the leaderboard, and the other entries here:

https://make.fun/bounty/gta6-01

## License

Released under the MIT licence — the full text is in `LICENSE`.

SPDX-License-Identifier: MIT
