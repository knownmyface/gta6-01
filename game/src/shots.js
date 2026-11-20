// CORAL HEAT v2.8 — screenshot staging. The four stills are real renders of
// the live game: the URL ?shot=chase|foot|marina|mission drops Kai into a
// composed scene (chase, carjack, marina, boat mission) with the HUD already
// dense, the menu hidden, and the camera framed. Nothing here is faked: every
// car, boat and star in the still is a live object in the running game.

export const STILL_NAMES = ['chase', 'foot', 'marina', 'mission'];

export function stillFromQuery() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (STILL_NAMES.includes(shot)) return shot;
  return null;
}

// facade — the live game hands shots.js these hooks; shots.js never touches
// three.js directly, it just directs the scene.
export function stageStill(f, name) {
  if (name === 'chase') {
    // COVER: Flare GT mid-chase on Beachfront Ave, heading north into the
    // sunset — two interceptors on the bumper, Air One ahead, palms and the
    // bay on the left, the city on the right.
    f.setMission(11, 2); // Heat Wave, final leg: the city is already hunting
    f.setCash(92450);
    f.giveRide('flare', -148, 44, Math.PI);
    f.setSpeed(34);
    f.spawnPursuit(2, 7);
    f.spawnHeli();
    f.setWanted(4);
    f.setObjective('Lose the PD — get to the marina docks.');
    // three-quarter side view: hero car big in frame, interceptors behind it
    // camera low and close, looking slightly up so Air One and the violet
    // top of the sunset stay in frame
    f.setCamera({ x: -142, y: 4.2, z: 30 }, { x: -149, y: 3, z: 46 });
    f.setRadio(0);
    return 'chase';
  }
  if (name === 'foot') {
    // ON FOOT: Kai mid-carjack beside a sedan at the -40 / -120 road crossing
    // (an open junction, no tower in the way), driver half out, prompt on
    // screen, two stars already lit.
    f.setMission(1, 0);
    f.setCash(3450);
    f.placeWalker(-44, -118, 0.8);
    f.stageCarjack('sedan', -40, -120, 0);
    f.setWanted(2);
    f.setObjective('Carjack a car on the street (walk up and press E).');
    f.setCamera({ x: -47, y: 3.4, z: -128 }, { x: -39, y: 1.2, z: -118 });
    return 'foot';
  }
  if (name === 'marina') {
    // MARINA: Kai at the helm of the Reef Runner between the docks, moored
    // yachts behind, sun low over the bay, patrol boat in the distance.
    f.setMission(2, 1);
    f.setCash(18200);
    f.giveBoat('runner', -232, 190, 0.8);
    f.setSpeed(20);
    f.spawnPatrolBoat(-270, 160);
    f.setWanted(1);
    f.setObjective('Sail out to the red buoy off the point.');
    // low view from the east, looking west into the sunset: the runner's
    // starboard side reads, the sun sits low over the bay behind it
    f.setCamera({ x: -214, y: 3.8, z: 178 }, { x: -232, y: 1.2, z: 190 });
    f.setRadio(2);
    return 'marina';
  }
  if (name === 'mission') {
    // MISSION: Smoke on the Water — cargo run at dusk, patrol boats closing,
    // objective banner live, speed high, wanted 3.
    f.setMission(4, 1);
    f.setCash(26400);
    f.giveBoat('runner', -302, 182, -0.5);
    f.setSpeed(32);
    f.spawnPatrolBoat(-312, 188);
    f.spawnPatrolBoat(-294, 192);
    f.setWanted(3);
    f.setObjective('Run the cargo to the south buoy — patrol boats are out.');
    // close three-quarter rear view: the runner big, both patrol boats in
    // frame, the marker beam behind them
    f.setCamera({ x: -296, y: 4, z: 176 }, { x: -304, y: 1.5, z: 184 });
    f.setRadio(1);
    return 'mission';
  }
  return null;
}
