# CORAL HEAT

[![make.fun](https://make.fun/badge.svg)](https://make.fun)
[![Competition](https://make.fun/bounty/gta6-01/badge.svg)](https://make.fun/bounty/gta6-01)
[![Entry](https://make.fun/entry/gta6-01/badge.svg)](https://make.fun/bounty/gta6-01)

**CORAL HEAT — 12 story missions, 5-star police, helicopter chases, carjacking, boats & radio in a sunset marina city**

An original open-world crime game in the spirit of GTA 6, built for the make.fun gta6-01 bounty: https://make.fun/bounty/gta6-01

## The city
Coral Bay — a sun-soaked coastal city of palm-lined boulevards, a beachfront strip, and a marina district full of moored boats. All names, characters, vehicles and story are original.

## What you can do
- Drive and steal cars across the city, on foot or behind the wheel
- Carjacking sequence: walk up to a parked car, pull the driver out, take it
- Drivable boats — take a speedboat out of the marina and across the bay
- 12 story missions, including 2 boat missions (smuggler run, marina getaway)
- 5-star wanted level: street cops, roadblocks, and a police helicopter
- On-foot and drive-by combat, weapon slots, health and damage
- Radio stations, cash, safehouse saves (localStorage), shops and garage
- Dense HUD: minimap, speedometer, wanted stars, cash, damage, weapon slots, radio station, objective banner

## How to play
Serve `game/` with any static HTTP server and open `game/index.html` in desktop Chrome. Keyboard + mouse. WASD drive / move, E enter or exit a vehicle, F carjack, Space handbrake, R radio, M mission list, Esc pause.

## Tech
Three.js (vendored under game/vendor/), plain static files, no build step, no network requests. Entry point `main.ts` copies game/ and screenshots/ to /output and writes /output/dossier.json via vendor/makefun-game.ts.

## License
MIT — see LICENSE.
