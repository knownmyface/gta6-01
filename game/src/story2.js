// CORAL HEAT — the story, missions 12-22: the crew, the casino heist
// finale chain and the boat escape. The heist runs recon, getaway driver,
// vault, then escape by boat; missions 21 and 22 are the waterfront
// pursuit, with police boats on the bay.
CH.story2 = (function () {
  const list = [
    { id: 12, title: 'The Back Room', sub: 'Meet the crew in the back streets', type: 'goto', target: { x: -240, z: -60 }, radius: 12, reward: 900 },
    { id: 13, title: 'Crew Call', sub: 'Pick the crew up at the marina safehouse', type: 'goto', target: { x: 180, z: 240 }, radius: 10, reward: 1000 },
    { id: 14, title: 'Tools of the Trade', sub: 'Stock up at the Neon Auto shop', type: 'goto', target: { x: 60, z: -180 }, radius: 8, reward: 800 },
    { id: 15, title: 'Casino Night', sub: 'Walk into the Coral Palms as a high roller', type: 'enter', target: { x: -150, z: -135 }, radius: 8, reward: 1500 },
    { id: 16, title: 'Vault Breach', sub: 'Hold the vault floor for 10 seconds', type: 'hold', target: { x: -150, z: -150 }, radius: 10, reward: 2000 },
    { id: 17, title: 'The Take', sub: 'CASINO HEIST — ESCAPE. Get out with 4 stars on you', type: 'escape', target: { x: 0, z: 240 }, radius: 16, reward: 3000 },
    { id: 18, title: 'Five-Star Exit', sub: 'Outrun a 5-star chase to the pier', type: 'escape', target: { x: 0, z: 300 }, radius: 14, reward: 3500 },
    { id: 19, title: 'To the Marina', sub: 'Reach the pier — the boat is waiting', type: 'goto', target: { x: 0, z: 300 }, radius: 12, reward: 1000 },
    { id: 20, title: 'Cast Off', sub: 'Board the speedboat and clear the harbour', type: 'boat', target: { x: 0, z: 360 }, radius: 16, reward: 1500 },
    { id: 21, title: 'Boat Getaway', sub: 'Outrun the police boats east along the bay', type: 'boat', target: { x: 120, z: 400 }, radius: 18, reward: 4000 },
    { id: 22, title: 'Harbor Pursuit', sub: 'Finale: lose the harbour patrol west', type: 'boat', target: { x: -120, z: 400 }, radius: 18, reward: 5000 },
  ];
  return { list };
})();
