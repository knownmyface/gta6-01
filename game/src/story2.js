// Coral Heat — story missions 13-22: street races, bikes and the garage
// (13-16), the casino-heist finale chain (17-20), and the boat getaway
// + waterfront pursuit that close the story (21-22).
import { MARINA_X } from './coralcity.js';
import { startRace } from './raceway.js';
import { buySafehouse } from './garage.js';

function at(G, x, z, r = 14) {
  return Math.hypot(G.player.pos.x - x, G.player.pos.z - z) < r;
}

export function defineMissions2(G) {
  const M = G.missions.list;
  M.push(
    {
      id: 13, name: 'Rookie Racer', desc: 'Enter a street race — drive to a start line and press T', reward: 2000, state: 'locked',
      target: [-222, -240],
      check(G) { return G.race.active || G.stats.racesEntered > 0; },
    },
    {
      id: 14, name: 'Podium Finish', desc: 'Win any street race', reward: 3500, state: 'locked',
      check(G) { return G.stats.racesWon > 0; },
    },
    {
      id: 15, name: 'Two Wheels', desc: 'Ride a bike 200 metres (spawn one with B)', reward: 2200, state: 'locked',
      check(G) { return G.stats.distanceBiked >= 200; },
    },
    {
      id: 16, name: 'Grand Tour Champion', desc: 'Win the Coral Grand Tour — the big one, 2 laps', reward: 8000, state: 'locked',
      target: [-222, -240],
      onStart(G) { startRace(G, 'grand'); },
      check(G) { return G.stats.grandTourWon; },
    },
    {
      id: 17, name: 'Casing the Casino', desc: 'Recon the Coral Casino — get eyes on the vault entrance', reward: 3000, state: 'locked',
      target: [186, -186],
      check(G) { return at(G, 186, -186, 22); },
    },
    {
      id: 18, name: 'Getaway Driver', desc: 'Hold 120 MPH with 3 wanted stars — prove you can drive the escape', reward: 4500, state: 'locked',
      check(G) {
        return G.player.mode === 'car' && Math.abs(G.player.speed) * 2.23694 >= 120 && G.player.wanted >= 3;
      },
    },
    {
      id: 19, name: 'The Vault', desc: 'Crack the casino vault — reach the casino floor with 2 stars on you', reward: 6000, state: 'locked',
      target: [186, -186],
      check(G) { return at(G, 186, -186, 18) && G.player.wanted >= 2; },
    },
    {
      id: 20, name: 'Escape by Boat', desc: 'Get to the marina and board a boat with 3 stars on you', reward: 6000, state: 'locked',
      target: [-280, 40],
      check(G) { return G.player.mode === 'boat' && G.player.wanted >= 3; },
    },
    {
      id: 21, name: 'Boat Getaway', desc: 'Outrun the police boats — stay afloat and stay ahead for 30 seconds', reward: 8000, state: 'locked',
      target: [-330, 0],
      onStart(G) {
        G.missionTimerStart = G.time;
        if (G.player.mode !== 'boat') {
          const { createPlayerBoat } = requireBoat(G);
          createPlayerBoat(G, 0);
        }
      },
      check(G) {
        if (G.player.mode !== 'boat') return false;
        return G.time - (G.missionTimerStart || G.time) >= 30;
      },
    },
    {
      id: 22, name: 'Waterfront Pursuit', desc: 'The crew escapes by boat — you run the Marina Row gauntlet at 120 MPH with 5 stars', reward: 10000, state: 'locked',
      target: [MARINA_X, 120],
      check(G) {
        return G.player.mode === 'car' && Math.abs(G.player.pos.x - MARINA_X) < 14
          && Math.abs(G.player.speed) * 2.23694 >= 120 && G.player.wanted >= 5;
      },
    },
  );
  // mission hooks fed by the race / garage systems
  G.missions.onRaceWon = (circuitId) => {
    G.stats.racesWon += 1;
    if (circuitId === 'grand') G.stats.grandTourWon = true;
  };
  G.missions.onSafehouseBought = () => {
    G.stats.safehousesOwned = (G.stats.safehousesOwned || 0) + 1;
  };
}

// Small indirection so mission 21 can put the player in a boat without a
// static import cycle (boats.js never imports story).
function requireBoat(G) {
  return G.boatApi;
}
