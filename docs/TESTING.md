# Testing & QA

## Automated checks

```bash
npm run typecheck   # tsc --noEmit (strict)
npm run build       # typecheck + production bundle
npm run preview     # serve dist/ for a production smoke test
```

### Debug hook (dev only)

`npm run dev` exposes the Phaser game as `window.__nwd`. Useful console snippets:

```js
const gs = __nwd.scene.getScene('GameScene');
gs.economy.earn(5000);                                   // money
gs.tapPlatform(3); gs.buildTower('tesla');               // build on platform 3
gs.tapPlatform(3); gs.upgradeSelected();                 // upgrade it
gs.waves.index = 7; gs.waves.state = 'waiting'; gs.waves.countdown = 0.1; // jump to wave 9
gs.hp = 1; gs.reactorHit(1);                             // force defeat
gs.waves.index = 9; gs.waves.state = 'complete'; gs.enemies.clear(); // force victory
localStorage.removeItem('neon-wasteland-defense:v1');    // reset save / replay tutorial
```

Headless browser runs (Playwright driving Edge) are useful for smoke tests and balance bots. Map game coordinates to screen coordinates through the canvas `getBoundingClientRect()` and the 1280×720 logical size.

## Manual QA checklist

### Boot and menu
- [ ] The loading label appears, then the menu, with no console errors.
- [ ] PLAY, SOUND and HELP all work. HELP → REPLAY TUTORIAL resets the hints. Sound persists after a reload.
- [ ] The campaign line under PLAY shows stars and sectors cleared after a win.

### Campaign
- [ ] Fresh save: PLAY goes straight into Sector 1. After clearing it, PLAY opens sector select.
- [ ] Locked sectors refuse taps (shake + error sound). Cleared sectors show their best stars.
- [ ] A victory shows NEXT SECTOR, which loads the next sector with its own start credits and towers.
- [ ] The first visit to Sector 2 / 3 shows "NEW TOWER UNLOCKED" (Laser / Cryo).
- [ ] Twin Gates spawns on both lanes. The Long Road's final wave includes the Titan.
- [ ] Retry and Restart replay the same sector.

### Tutorial (fresh save)
- [ ] The hand pointer goes "Tap to build" → "Pick a tower" → "Start the wave!", and never blocks taps on anything else.
- [ ] Tapping the beacon at any moment starts wave 1 and removes the hints.
- [ ] Wave 1 starts within about 6 s of the first tower, or after 25 s if nothing is built.
- [ ] The hints don't come back on the next run.

### Building and economy
- [ ] Every tower allowed in the sector can be built (4 / 5 / 6 per sector), and towers not allowed can't. Credits are deducted and a cost popup appears.
- [ ] Unaffordable cards are greyed out with a red cost; tapping one shakes it and plays an error sound.
- [ ] Upgrades reach Lv3. The visuals change at each level. The button shows MAX LEVEL at Lv3.
- [ ] Selling refunds 70% of the total investment, and the platform hint comes back.
- [ ] Kill rewards, wave bonuses and early-call bonuses all add credits.

### Combat
- [ ] Every tower rotates (except Tesla) and attacks the enemy furthest along the road.
- [ ] Pulse fires bolts. Cannon recoils with a flash. Missiles splash with a shockwave ring. Tesla chains arcs. Laser charges, then holds a beam.
- [ ] Shields absorb damage and shatter visibly; Tesla clearly melts them.
- [ ] Cryo pulses tint machines icy blue and visibly slow them; the Titan and Juggernauts slow less.
- [ ] The Juggernaut switches to its damaged texture below 50% HP.
- [ ] Spawners glow, then release swarmlings that keep following the road.
- [ ] Health bars appear only on damaged enemies.
- [ ] Enemies reaching the reactor cost HP, with a red flash and a small screen shake.

### Waves and endings
- [ ] Wave banners appear, including NEW-enemy intros on waves 3, 5, 7 and 9, and FINAL WAVE on wave 10.
- [ ] The countdown ring and early bonus show on the beacon.
- [ ] Victory happens only after wave 10 has spawned and the field is clear. Stars match the HP thresholds.
- [ ] Defeat at 0 HP. Revive works once (+10 HP, field cleared). Retry and Menu work.
- [ ] Restarting several times leaves no duplicate listeners or leftover sprites.

### Controls and platform
- [ ] 1x/2x speed affects movement, firing and effects. Pause freezes everything.
- [ ] Switching tabs auto-pauses the game and silences audio.
- [ ] Keyboard: Space, 1–6 (drawer order), U, S, F, P/Esc.
- [ ] Mobile landscape: taps hit platforms, cards and buttons; text is readable.
- [ ] Mobile portrait shows the rotate prompt.
- [ ] The game fills the whole screen at any aspect ratio (phone, tablet, ultrawide) and the battlefield stays fully visible; resizing and rotating re-fit it.

### Performance
- [ ] Holds about 60 FPS during wave 10 on a mid-range laptop at 2x speed.
- [ ] No steady memory growth across several restarts (check the DevTools memory panel).
