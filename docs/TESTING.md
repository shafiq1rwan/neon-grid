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

Headless browser runs (Playwright driving Edge) are useful for smoke tests and balance bots. Map game coordinates to screen coordinates through the canvas `getBoundingClientRect()` and the 1280×720 logical size. In a portrait mobile viewport the game is auto-rotated, so that mapping doesn't hold: compute the point inside the container (u, v) from `canvas.clientWidth/Height` and `offsetLeft/Top`, then tap the screen at (`container.clientHeight − v`, u).

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

- [ ] Catalogue shows all sector towers (4/5/6) in one row, with centered icons/prices and short roles. Each card builds the correct tower; paging controls stay hidden when everything fits.
- [ ] Upgrade/sell buttons have matching size, centered label/price groups, equal padding, and a 12-unit gap. Mobile panels and HUD scale proportionally with the battlefield, without fixed pixel enlargement crowding small screens.
- [ ] At 1280×720, build cards have centered icons/roles/prices, stat text does not overlap, and the upgrade panel is 640 wide, upgrade/sell buttons both measure 294×66px with 8px top/bottom content padding. The same logical spacing scales down on phones.
- [ ] Upgrade comparisons show slow strength/duration, chain targets, splash radius, or beam warm-up where applicable. Missing credits and maximum level are clear; resize closes open drawers and reopening fits the new size.
- [ ] Every tower allowed in the sector can be built (4 / 5 / 6 per sector), and towers not allowed can't. Credits are deducted and a cost popup appears.
- [ ] All six towers have distinguishable Lv1/Lv2/Lv3 silhouettes and front level indicators. Icons show complete foundations; Cryo crystals remain aligned with their glow after upgrades.
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
- [ ] Juggernaut/Titan treads animate with travel distance and slow with frost. Exhaust trails the rear; damage smoke appears below 50% HP and thickens below 25%.
- [ ] Tank armor hits spark; tank destruction throws fragments, with a larger Titan blast. Pause freezes these effects; 2x accelerates them; restart leaves no duplicate emitters.
- [ ] Spawners glow, then release swarmlings that keep following the road.
- [ ] Health bars appear only on damaged enemies.
- [ ] Enemies reaching the reactor cost HP, with a red flash and a small screen shake.

### Hacking
- [ ] Fresh hint state: after wave 1 starts, "Tap to hack!" points at the leading on-screen machine; the first lock shows "Tap again when the rings meet!"; the hint never returns after the first hack, or after 10 s on screen without a hack.
- [ ] Tapping a machine with a charge starts the lock: bullet time, closing ring, reactor data beam. The "TAP!" cue appears only in the window and stays clear of the HUD.
- [ ] A tap in the window gives PERFECT HACK (big text, white ring, flash); no tap gives a normal "HACKED".
- [ ] A hacked machine is cyan with a glow and a fuse bar, walks back, and detonates on contact. Blast kills pay credits.
- [ ] Hacked Spawners release hacked swarmlings. The Titan shows FIREWALL and keeps the charge. A Juggernaut with only 1 charge shows "NEEDS 2 CHARGES".
- [ ] No charges: "NO CHARGE" and the HACK pill shakes. Earning a charge: the pill pops and "+1 HACK" appears.
- [ ] A tap just after an auto-resolve doesn't open the build drawer. Pause during a lock freezes it. Game over during a lock refunds the charge.
- [ ] Works with touch on a phone-sized screen, and at 2x speed (the lock timing doesn't speed up).

### Endless mode
- [ ] Before Sector 1 is cleared, the ENDLESS strip on sector select is locked ("Clear Sector 1 to unlock") and shakes when tapped.
- [ ] Unlocked: tapping it opens the map picker; only cleared sectors' maps can be chosen; each shows its best wave. ✕, tapping outside and Esc close it.
- [ ] A run starts with at least 400 credits, no tutorial or build nudge; the HUD shows "WAVE 7" (no total) and dots counting to the next boss wave. Pause shows sector, wave, reactor HP and personal best, with no Challenges link.
- [ ] Waves keep coming; every 10th is "BOSS WAVE N" (red banner) with Titans; new enemy types are announced as they join.
- [ ] Defeat shows "NEW BEST!" / "RUN OVER", wave reached and best, W10/W20/W30 stars and "+1 ★ NEW" for new milestones. The best wave is saved per map and appears on the strip, in the picker and on the menu line.
- [ ] RETRY and the Workshop's RETRY ENDLESS restart Endless on the same map (with the usual commercial break); Revive works as in the campaign.

### Juice (v1.2.5)
- [ ] Quick kills ring rising dings; a pause resets the pitch. The credits counter rolls up on gains and drops instantly on spending (cards and upgrades always show the right affordability).
- [ ] The last kill of a wave gives a short slow motion and a burst. A Perfect Hack, a x5+ combo and Juggernaut / Titan kills freeze the world for a few frames (the hack lock keeps real time).
- [ ] At 30% reactor HP or less, red screen edges pulse with a heartbeat (faster at 15%); they stop when paused, at game over and after a revive.

### Supply drops
- [ ] Sector 1: a pod falls and lands (ring, puff, small shake) right after wave 1 finishes spawning, then after waves 3, 5, 7, 9. "TAP!" bobs above it.
- [ ] Tapping pays credits (popup + coins fly to the counter); every third pod gives "+1 HACK" if charges aren't full. Ignored pods blink and power down after ~12 s.
- [ ] Pods never land on the road, a platform, the reactor, the beacon or under the HUD, and tapping one never opens a build drawer or starts a hack. Restart / game over clears the pod.

### Build nudge
- [ ] Save without Sector 1 cleared: about 4 s after the player can afford a tower with an empty platform, a hand + "Build another tower!" (or "Build a tower!" with no towers) points at a good platform. It hides while the drawer is open, during the tutorial, the hack hint, a hack lock and pause.
- [ ] Ignored for 8 s, it disappears for 20 s. Building or upgrading makes it go away at once.
- [ ] With every platform used and an affordable upgrade, it shows "Upgrade a tower!" on the cheapest upgrade.
- [ ] Never shows once Sector 1 has been cleared.

### Workshop and challenges
- [ ] Fresh save: no WORKSHOP button on the menu. After earning a star (sector rating or challenge), the menu and result screens show WORKSHOP with the stars to spend.
- [ ] Workshop: buying a level spends the right stars, shows the new effect and level pips, and greys out when unaffordable or maxed. RESET needs two taps and refunds everything.
- [ ] Perks apply on the next run: starting credits, wave bonus toast amounts, sell refund (upgrade panel and actual credits), starting hack charges, reactor HP (HUD and result "x / max").
- [ ] Stars still rate HP lost (3 stars = lost at most 2 HP), so Reactor Plating adds a cushion without changing thresholds.
- [ ] Pause has one prominent Resume action. Challenges opens the sector's two goals with current progress, a Requires victory label where needed, and Done for previously earned stars. Back returns to pause; P / Esc resumes from either view.
- [ ] Skill challenges (perfect hacks, combo, early calls) complete on defeat too; "win without..." ones only on victory. Each pays +1 star once ("+1 ★ NEW" on the result screen).
- [ ] Defeat → WORKSHOP → RETRY SECTOR N restarts that sector (with a commercial break).

### Waves and endings
- [ ] Ordinary waves use a compact pill; first-enemy introductions show wave, enemy name/icon and a short counter-tip without clipping. Boss and final-wave warnings stay red. Banners dismiss automatically and later waves replace them cleanly.
- [ ] The countdown ring and early bonus show on the beacon.
- [ ] When the field is clear between waves, the countdown drops to 3 s and a "WAVE N CLEARED" card shows kills, credits (plus perfect hacks / best combo when there were any). The card hides when the next wave starts.
- [ ] A hack blast, missile or Tesla chain that destroys 3+ machines shows "xN COMBO!" (pink from x5).
- [ ] 2x speed is remembered after a restart, a new sector and a page reload.
- [ ] Victory happens only after wave 10 has spawned and the field is clear. Stars match the HP thresholds.
- [ ] Defeat at 0 HP. Revive works once (+10 HP, field cleared). Retry and Menu work.
- [ ] Restarting several times leaves no duplicate listeners or leftover sprites.

### Controls and platform
- [ ] 1x/2x speed affects movement, firing and effects. Pause freezes everything. Pause sound persists; Resume and P / Esc work. During a pending restart ad break the pause overlay stays visible and blocks Resume and repeated navigation.
- [ ] Switching tabs auto-pauses the game and silences audio.
- [ ] Keyboard: Space, 1–6 (drawer order), U, S, F, P/Esc.
- [ ] Mobile landscape: taps hit platforms, cards and buttons; text is readable.
- [ ] Mobile portrait auto-rotates: the game fills the screen sideways (no bands, nothing cut off), and taps on platforms, cards, buttons and machines (hack lock) land where the finger is. Turning the phone to landscape and back re-fits it each time.
- [ ] The game fills the whole screen at any aspect ratio (phone, tablet, ultrawide) and the battlefield stays fully visible; resizing and rotating re-fit it.

### Performance
- [ ] Holds about 60 FPS during wave 10 on a mid-range laptop at 2x speed.
- [ ] No steady memory growth across several restarts (check the DevTools memory panel).
