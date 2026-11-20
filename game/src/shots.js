// Coral Heat — screenshot staging. The four stills are real renders of the live
// game: the URL ?shot=chase|foot|marina|mission drops Kai into a composed scene
// (chase, carjack, marina, boat mission) with the HUD already dense, the menu
// hidden, and the camera framed. Nothing here is faked: every car, boat and star
// in the still is a live object in the running game.

export const SHOT_NAMES = ['chase', 'foot', 'marina', 'mission'];

export function shotFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (SHOT_NAMES.includes(shot)) return shot;
  return null;
}

// facade — the live game hands shots.js these hooks; shots.js never touches
// three.js directly, it just directs the scene.
export function applyShot(f, name) {
  if (name === 'chase') {
    // COVER: Comet GT mid-chase on Beachfront Ave, heading north into the
    // sunset — two cruisers on the bumper, Air One ahead, palms and the bay
    // on the left, the city on the right.
    f.setMission(11, 2); // Heat Wave, final leg: the city is already hunting
    f.setCash(86420);
    f.giveRide('comet', -150, 40, Math.PI);
    f.setSpeed(31);
    f.spawnPursuit(2, 6);
    f.spawnHeli();
    f.setWanted(3);
    f.setObjective('Lose the PD — get to the marina docks.');
    // three-quarter side view: hero car big in frame, cruisers behind it
    f.setCamera({ x: -138, y: 5, z: 28 }, { x: -150, y: 2, z: 42 });
    f.setRadio(0);
    return 'chase';
  }
  if (name === 'foot') {
    // ON FOOT: Kai mid-carjack beside a sedan on Sunset Strip, driver half
    // out, prompt on screen, two stars already lit.
    f.setMission(1, 0);
    f.setCash(3120);
    f.placeWalker(-58, -118, 1.2);
    f.stageCarjack('sedan', -56, -116, 1.2);
    f.setWanted(2);
    f.setObjective('Carjack a car on the street (walk up and press E).');
    f.setCamera({ x: -60, y: 3.4, z: -124 }, { x: -55, y: 1.2, z: -114 });
    return 'foot';
  }
  if (name === 'marina') {
    // MARINA: Kai at the helm of the Reef Runner between the docks, moored
    // yachts behind, sun low over the bay, patrol boat in the distance.
    f.setMission(2, 1);
    f.setCash(17450);
    f.giveBoat('speedboat', -215, 120, Math.PI / 2);
    f.setSpeed(18);
    f.spawnPatrolBoat(-280, 60);
    f.setWanted(1);
    f.setObjective('Sail out to the red buoy off the point.');
    f.setCamera({ x: -208, y: 6.5, z: 96 }, { x: -230, y: 1.5, z: 130 });
    f.setRadio(1);
    return 'marina';
  }
  if (name === 'mission') {
    // MISSION: Smoke on the Water — cargo run at dusk, patrol boats closing,
    // objective banner live, speed high, wanted 3.
    f.setMission(4, 1);
    f.setCash(25800);
    f.giveBoat('speedboat', -300, 180, -0.5);
    f.setSpeed(30);
    f.spawnPatrolBoat(-318, 196);
    f.spawnPatrolBoat(-288, 212);
    f.setWanted(3);
    f.setObjective('Run the cargo to the south buoy — patrol boats are out.');
    // three-quarter rear-side view of the boat, patrol boats guarding the buoy
    f.setCamera({ x: -289, y: 4.5, z: 173 }, { x: -303, y: 1.5, z: 185 });
    f.setRadio(0);
    return 'mission';
  }
  return null;
}
