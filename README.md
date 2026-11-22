# CORAL HEAT

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/knownmyface/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/knownmyface/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

> A 3D WebGL open-world crime game set in a sunset coastal marina city.
> Built with three.js. No Rockstar names, art, music, or maps — every city,
> character, vehicle, and story beat here is original.

**[▶ Play the bounty — make.fun/bounty/gta6-01](https://make.fun/bounty/gta6-01)**

---

## What it is

Coral Heat drops you into **Port Coral**, a neon-lit marina city where the
sun never quite sets. Palm-lined boulevards run into a working harbour,
a glittering casino strip, quiet safehouse streets, and open water.

You are a small-time driver with big debts and one fast car. Take jobs,
outrun the law, build a crew, and work your way up to the biggest score
the city has ever seen — a casino heist that ends on the water.

Everything runs in the browser. No install, no account, no downloads
beyond the page itself. Open it, drive, and the city is yours.

## How to play

### On foot

Walk the streets, explore the marina, and scope out your next job.
Talk to contacts, pick up missions, and slip away before the police
notice you. On foot you are fast, nimble, and easy to lose in a crowd —
but you are also exposed.

### Driving

Steal it, buy it, or earn it — if it has wheels, you can drive it.
Cars handle differently on dry boulevards, wet marina roads, and tight
casino-strip corners. Motorcycles are quicker through traffic and
harder to shake off, but one bad turn can end the ride.

Press **E** near a parked car to get in. Press **F** to carjack a
moving car — expect the driver, and the law, to object.

### Missions — 22 story missions

A full story chain of **22 missions** takes you from courier runs and
getaway driving to street races, garage jobs, and the casino heist
finale:

- **Early jobs:** deliveries, pickups, and timed drives that teach
  the city and earn your first cash.
- **Street races:** head-to-head sprints through the marina district
  and the casino strip. Win them to unlock faster cars and new
  contacts.
- **Mid-game:** garage work, safehouse runs, and jobs that raise your
  reputation — and your wanted level.
- **The casino heist finale:** a multi-stage chain that ends the story
  in style.
- **Boat missions 21–22:** the finale moves to the water. Steal a
  boat, outrun the harbour patrol, and make the marina escape in a
  high-speed boat chase.

### Wanted level, police, and helicopter

Cause trouble and the city answers. Your wanted level climbs with
carjackings, crashes, shootouts, and heists:

- **Low heat:** patrol cars tail you and try to box you in.
- **High heat:** roadblocks, faster pursuit cars, and aggressive
  drivers who will ram you off the road.
- **Maximum heat:** a police helicopter joins the chase, tracking you
  from above and calling in ground units.

Lose the cops by breaking line of sight, cutting through alleys,
switching vehicles, or disappearing into the marina. Lay low until
the heat fades.

### Weapons and the weapon wheel

Pick up weapons around the city and switch fast with the weapon wheel.
**1–4** selects your loadout on the fly — pistol, shotgun, SMG, and
rifle — so you are never caught with the wrong tool for a getaway
or a standoff.

### Garage and safehouses

Your garage is where cars become yours. Store the vehicles you steal
or win, keep your favourites ready, and return between jobs to save
progress. Safehouses scattered across the city give you a place to
lie low, change cars, and start the next mission fresh.

### Boats and the marina

Port Coral is a harbour city, and the water is part of the game.
Boats handle with real momentum — wide turns, heavy wakes, and real
speed on open water. Dock at the marina, steal a boat, and use the
harbour to escape when the roads are closed to you.

### Radio

The city has a soundtrack. Press **R** to flip radio stations while
you drive — sunset synth, street beats, and late-night marina
frequencies, all original and built for the game.

### Saving

Progress saves automatically to your browser with **localStorage**.
Close the tab, come back later, and your missions, garage, cash,
and safehouses are still there.

## Controls

| Key | Action |
| --- | --- |
| **W A S D** | Drive / walk |
| **Mouse** | Camera |
| **E** | Enter / exit vehicle |
| **Space** | Brake / handbrake |
| **F** | Carjack |
| **1 – 4** | Weapons / weapon wheel |
| **R** | Radio |
| **M** | Minimap |
| **Esc** | Pause |

Tip: tap Space to brake, hold it to handbrake-slide around tight
corners. On a motorcycle, steer early — momentum is everything.

## How to run locally

The game is static files only. Serve the `game/` directory with any
static server, then open the game in your browser.

```bash
cd game
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/index.html
```

You can also use the repo's serve entrypoint (`serve.ts`) if you
prefer to run it that way — it serves the same static game files.

No build step is required. No account or backend is needed.

## Screenshots

1. **Dense neon casino chase cover** — the casino strip at sunset,
   pursuit cars closing in under the neon.
2. **Marina boat chase** — a high-speed escape across the harbour,
   patrol boats in the wake.
3. **On-foot carjacking** — taking a car on a quiet street, before
   the sirens start.
4. **Street race** — bumper-to-bumper racing through the marina
   district at dusk.

Screenshots live in `screenshots/` in this repo.

## Tech notes

- **Engine:** three.js, vendored locally under `game/vendor/`.
- **Rendering:** WebGL, built for modern desktop browsers.
- **Networking:** none. The game makes no network requests while
  playing — all code, models, textures, and audio are local files.
- **Files:** static only. Serve the folder and play.
- **Save data:** localStorage in your own browser, nothing leaves
  your machine.

## License

MIT — see `LICENSE` for the full text.

SPDX-License-Identifier: MIT
