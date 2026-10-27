# Game Design — Neon Wasteland

## Pitch

The machines broke loose after a technological collapse. You control the last automated defense network in a ruined neon city. Build turrets on abandoned defense platforms, upgrade them, and hold four city sectors (44 waves in total) against corrupted machines before they reach the energy reactor.

- **Genre:** fixed-placement tower defense (Kingdom Rush style placement, original mechanics and art)
- **Platform:** browser (Poki), desktop and mobile, mouse and touch
- **Session:** about 6–9 minutes per sector; about 30 minutes for the full campaign
- **Goal clarity:** a player should understand "build on the glowing pads, protect the reactor" within 10 seconds

## Core loop

1. Tap a glowing platform, then pick a tower.
2. The wave starts, either from the countdown or by tapping the beacon.
3. Towers fire automatically. Destroyed machines drop credits.
4. Spend credits between and during waves on new towers or upgrades.
5. Survive every wave of the sector and clear the field to win. Winning unlocks the next sector. If the reactor reaches 0 HP, you lose.

## Rules

| Rule | Value | Source |
| --- | --- | --- |
| Reactor HP | 20 | `ECONOMY.startingHp` |
| Starting credits | Per sector: 220 / 300 / 360 | `MapDef.startCredits` |
| Sell refund | 70% of total investment | `ECONOMY.sellRefund` |
| First wave countdown | 25 s, cut to 6 s once the first tower is built | `WAVE_TIMING.firstWaveCountdown`, `afterFirstTower` |
| Gap between waves | 14 s after the previous wave finishes spawning; cut to 3 s as soon as the field is clear | `WAVE_TIMING.betweenWaves`, `afterFieldClear` |
| Game speed | 1x / 2x; every sector starts at 1x (v1.2.3; it used to be remembered, which shortened sessions) | `GameScene.toggleSpeed` |
| Combo | One hack blast, missile splash or Tesla chain that destroys 3+ machines shows "xN COMBO!" (feedback only, no bonus) | `WAVE_TIMING.comboMin` |
| Wave summary | When the field is clear between waves: kills, credits earned, perfect hacks and best combo since the last summary | `GameEvents.waveCleared` |
| Early-call bonus | 2 credits per remaining countdown second | `ECONOMY.earlyCallBonusPerSecond` |
| Victory | Wave 10 fully spawned **and** no enemies left | `GameScene.update` |
| Defeat | Reactor HP reaches 0 | `GameScene.reactorHit` |

### Damage model

Damage is applied in this order:

1. **Shield** absorbs damage first. The tower's `shieldMultiplier` scales damage against shields: Tesla 2x, Laser 1.5x. Damage left over after the shield breaks carries through to health.
2. **Armor** is a flat reduction per hit: `max(dmg − armor, dmg × 0.25)`. It does not apply to *piercing* towers (Cannon, Laser) or to continuous beam ticks.
3. **Health.** At 0 the enemy dies and its reward is paid.

### Targeting

Every tower targets the enemy **furthest along the path** within its range ("first" priority). It re-evaluates every 0.15 s. The Laser keeps its lock until the target dies or leaves range, so it doesn't lose its warm-up charge.

Every targeting query (`Targeting` in `systems/TargetingSystem.ts`) skips **hacked** and **burrowed** machines. That covers tower targets, laser locks, Tesla chain jumps, missile splash, frost pulses and hack blasts. A burrowed machine also takes no damage and can't be slowed, so a shot already in flight when it digs in hits the dirt.

## Towers

Each tower has 3 levels. Every upgrade changes both the stats and the artwork (bigger weapon, more armor, more neon).

| Tower | Role | Attack | Special |
| --- | --- | --- | --- |
| **Pulse** (cyan) | Cheap starter, anti-runner | Fast homing bolts | — |
| **Cannon** (pink) | Anti-armor | Heavy shells, visible recoil | Piercing; Lv3 has twin barrels |
| **Missile** (orange) | Crowd control | Homing missiles | Splash damage, full in the inner 50% and 60% at the edge |
| **Tesla** (purple) | Shield breaker, groups | Instant chain lightning | Chains to nearby enemies with 0.85x damage per jump; 2x vs shields |
| **Laser** (green) | Sustained DPS | Continuous beam | Warm-up before damage; piercing; 1.5x vs shields |
| **Cryo** (ice blue) | Crowd control / support | Frost pulse hitting everything in range | Slows machines (bosses resist part of it); frozen machines take +15% damage from every tower |

### Stats

Cost is the build cost for Lv1 and the upgrade cost for Lv2/Lv3.

| Tower | Lv | Cost | Damage | Interval (s) | Range | Extra |
| --- | --- | --- | --- | --- | --- | --- |
| Pulse | 1 | 70 | 9 | 0.34 | 135 | |
| | 2 | 75 | 15 | 0.30 | 145 | |
| | 3 | 125 | 23 | 0.24 | 160 | |
| Cannon | 1 | 110 | 46 | 1.30 | 140 | |
| | 2 | 105 | 78 | 1.20 | 150 | |
| | 3 | 175 | 128 | 1.05 | 162 | |
| Missile | 1 | 130 | 30 | 1.80 | 170 | splash 62 |
| | 2 | 125 | 50 | 1.60 | 182 | splash 72 |
| | 3 | 195 | 76 | 1.40 | 198 | splash 84 |
| Tesla | 1 | 120 | 20 | 0.95 | 125 | 3 targets, chain 90 |
| | 2 | 115 | 30 | 0.85 | 135 | 4 targets, chain 98 |
| | 3 | 185 | 44 | 0.72 | 148 | 6 targets, chain 108 |
| Laser | 1 | 150 | 52/s | beam | 150 | warm-up 0.80 s |
| | 2 | 140 | 88/s | beam | 162 | warm-up 0.65 s |
| | 3 | 220 | 140/s | beam | 178 | warm-up 0.50 s |
| Cryo | 1 | 125 | 10 | 1.10 | 135 | slow 40% for 2.0 s |
| | 2 | 115 | 17 | 1.00 | 148 | slow 50% for 2.3 s |
| | 3 | 180 | 28 | 0.85 | 162 | slow 60% for 2.6 s |

### Tower unlocks

Each sector adds one tower, introduced with a "NEW TOWER UNLOCKED" reveal on the first visit and a chip on the sector select card.

| Sector | Towers available |
| --- | --- |
| 1. Reactor Row | Pulse, Cannon, Missile, Tesla |
| 2. Twin Gates | + **Laser** |
| 3. The Long Road | + **Cryo** (all six) |

Tesla stays in Sector 1 because Shielded Specters arrive there and Tesla is their counter. The build drawer and the `1`–`6` keys only offer the sector's towers.

## Hacking (signature mechanic)

**Pitch:** "Hack the invasion": reprogram corrupted machines and send them back to blow up their own army.

### How it works (timing lock)

1. **Tap a machine** on the road while you have a charge.
   - The game drops into **bullet time** (30% world speed).
   - A **lock-on ring** closes in on the target, with a data beam streaming from the reactor.
2. **Tap again** while the closing ring is inside the bright band. A **"TAP!"** cue shows the window. That's a **PERFECT HACK**: a bigger and longer blast.
3. If you don't tap, the ring closes and the machine is **hacked normally**. Nobody gets stuck.

A hacked machine:
- turns cyan, with a glow, a signal icon and a fuse bar,
- turns around and walks **back down the road**,
- **detonates** when it touches any enemy machine.

| Rule | Value |
| --- | --- |
| Charges | Start with 1, max 3 |
| Earning charges | +1 per 28 kills; +1 at the start of every 3rd wave |
| Cost | 1 charge; **Juggernaut costs 2**; the **Titan is immune** ("FIREWALL", no charge used) |
| Burrowers | Can't be tapped while underground. A lock-on pins a Burrower to the surface until it resolves, and a hacked Burrower never digs in |
| Lock-on | 0.85 s of real time (it ignores 2x speed). The PERFECT window runs from 72% of the lock until 0.12 s after it closes |
| Hacked duration | 8 s (PERFECT: 10 s), then it short-circuits harmlessly. It also never damages the reactor |
| Blast | 72 px radius. Damage = 1.25 × the machine's max HP, capped at 380 × its HP scale. Ignores armor, 2x vs shields. Full damage in the inner half, 65% at the edge |
| PERFECT | ×1.45 damage, ×1.25 radius, +2 s duration |
| Type twists | Juggernaut: ×1.3 radius. Specter: EMP blast (3x vs shields). Swarm Spawner: its swarmlings spawn already hacked. Swarmling: ×0.7 radius. Repair Drone: stops repairing |
| Credits | The hacked machine gives none; machines killed by the blast pay normally |

Towers, chain lightning, missile splash and frost all ignore hacked machines. A hacked machine walking back passes over burrowed ones without detonating. A late tap just after an auto-resolve is swallowed for 0.4 s, so it can't open a build menu by accident.

**UI:**
- **HACK pill** under the stats panel: three charge diamonds and a progress bar to the next charge. It pops when a charge is earned and shakes when a hack is denied. Tapping it shows a tip.
- **Feedback popups:** "HACKED" / "PERFECT HACK!", "NO CHARGE" / "NEEDS 2 CHARGES", "FIREWALL".
- **One-time hint** (it never blocks): a hand on the leading on-screen machine with **"Tap to hack!"**, then **"Tap again when the rings meet!"** during the first lock. It retires after the first hack, or after it has been on screen for 10 seconds without one, and never returns. Stored as `hackTipDone`.

## Enemies

Base values below. Each wave multiplies HP and shield by its `hpScale`.

| Enemy | HP | Shield | Armor | Speed (px/s) | Reward | Leak dmg | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Corrupted Drone | 60 | — | — | 64 | 5 | 1 | Basic quadcopter |
| Rift Runner | 44 | — | — | 128 | 7 | 1 | Fast; teal trail |
| Wasteland Juggernaut | 560 | — | 5 | 34 | 30 | 3 | Tank; looks damaged below 50% HP |
| Shielded Specter | 120 | 130 | — | 58 | 18 | 2 | Purple shield bubble shatters when broken |
| Swarm Spawner | 540 | — | 2 | 38 | 36 | 3 | Releases 2 swarmlings every 4.5 s |
| Swarmling (spawned) | 22 | — | — | 82 | 2 | 1 | Starts at the spawner's position and follows the rest of the road |
| **Titan War Machine** (boss) | 2600 | — | 8 | 22 | 220 | 10 | Sector 3 and 4 finale. A huge red war machine with twin cannons; looks damaged below 50% HP |
| **Repair Drone** | 150 | — | — | 42 | 20 | 2 | Sector 4. Every 3 s, each damaged machine within 105 px gets back 15% of its max HP (at most 40 × HP scale per pulse) |
| **Burrower** | 200 | — | 3 | 52 | 18 | 2 | Sector 4. Up for 4 s, then digs in for 150 px of road |

Each sector also has a `difficulty` multiplier on enemy HP and shields (1.05 / 1.4 / 1.84 / 1.15). It was raised about 8% when hacking was added; Sector 1 was then lowered in v1.1.2 after the web fit test.

### Repair Drone (medic)

- A round hover-saucer with a green repair cross and two welding arms. It glows brighter as its next pulse charges.
- **Pulse:** a green ring at its repair radius, plus green beams to every machine it repaired. Each repaired machine also gets a small spark.
- It never repairs itself, hacked machines or burrowed ones, and it only pulses when something in range is damaged (otherwise it waits, fully charged). Heavies repaired back above half HP lose their battle-damage look.
- It's slower than drones and a bit faster than Juggernauts, so it drifts through a pack and escorts heavies. It's fragile (no armor) and costs 1 hack charge. A hacked Repair Drone repairs nothing, and its blast takes out the pack it was healing. Splash and chains catch it in the middle of the pack.

### Burrower

- A segmented digging machine with a spiral drill nose.
- **Cycle:** above ground for 4 s, then it digs in (0.35 s sink animation), travels 150 px of road underground and pops back up with a burst of dirt. While burrowed it shows as a dirt mound that ploughs along the road, with a dust wake.
- **While burrowed:** untargetable and immune to everything: towers, beams, chains, splash, frost, hacks and hack blasts. Its health bar is hidden.
- It never digs in when that would leave it underground within 140 px of the end of its road, so it always surfaces before the reactor.
- The counter is placement: cover the stretches where it resurfaces, and use burst damage (Cannon, Missile) on the surfaced windows.

Slow resistance: the Juggernaut ignores 25% of frost slow and the Titan 50%.

## Campaign

Four sectors, played in order. Clearing a sector (any star rating) unlocks the next. First-time players go straight into Sector 1 from PLAY; after that, PLAY opens the sector select screen.

| # | Sector | Twist | Waves | Platforms | Start credits | Difficulty | Typical length |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Reactor Row** | One winding road; tutorial; 4 towers | 10 | 10 | 220 | 1.05 | about 6 min |
| 2 | **Twin Gates** | Two entrance roads merge into one trunk; enemies alternate lanes or use a fixed one; unlocks Laser | 10 | 11 | 300 | 1.4 | about 6.5 min |
| 3 | **The Long Road** | Long three-row serpentine; unlocks Cryo; finale against the Titan boss | 12 | 12 | 360 | 1.84 | about 8.5 min |
| 4 | **Crossfire Junction** | Two roads that cross each other twice; introduces the Repair Drone and the Burrower; Titan finale with a repair escort | 12 | 12 | 500 | 1.15 | about 8–9 min |

Times are at 1x speed with natural wave pacing. Wave lists for Sectors 2–4 are in `src/game/data/waves.ts` (`WAVES_SECTOR_2`, `WAVES_SECTOR_3`, `WAVES_SECTOR_4`). New enemy types are only announced the first time they appear in the campaign.

## Waves (Sector 1)

| Wave | HP × | Enemies | Theme | Clear bonus |
| --- | --- | --- | --- | --- |
| 1 | 1.00 | 9 | Drones | 35 |
| 2 | 1.10 | 16 | Drones (faster second group) | 40 |
| 3 | 1.20 | 16 | **Rift Runners introduced** | 40 |
| 4 | 1.28 | 24 | Runner pressure | 40 |
| 5 | 1.48 | 22 | **Juggernauts introduced** | 45 |
| 6 | 1.56 | 31 | Juggernauts + swarm | 55 |
| 7 | 1.64 | 18 | **Specters introduced** (3 Specters, 1 Juggernaut) | 70 |
| 8 | 1.64 | 24 | Specters + runners + 1 Juggernaut, spread out | 75 |
| 9 | 1.86 | 29 | **Swarm Spawners introduced** | 80 |
| 10 | 1.98 | 42 | Final mixed assault | — |

Waves 1–2 use an 8 s gap (`gap` in `WaveDef`); every other wave uses `WAVE_TIMING.betweenWaves`.

**Denser waves (v1.2.3, all sectors and Endless):** `densify()` in `data/waves.ts` turns every light group (Drones, Runners, Specters, Swarmlings, Repair Drones, Burrowers; 3 or more) into 1.35× as many machines at 0.75× HP (`WAVE_TIMING.lightCountMult` / `lightHpMult`), with kill rewards × 1/1.35 so credits per wave stay the same. Spawn intervals are kept, so waves last longer. The tables list the base counts before this rule. Sector 1 wave 10 (HP × 1.86, 5 Specters) and Sector 2 wave 6 (HP × 1.65, 2 Juggernauts) were softened in v1.2.3. In v1.2.4, Sector 1 waves 1–2 are exempt from densifying (`noDensify`) and wave 10 has one Spawner and no late Juggernaut. Waves 6–10 and the sector `difficulty` (1.19 → 1.05) were lowered in v1.1.2 after the web fit test: only 22% of players cleared Sector 1, and a third of those who reached wave 8 lost there.

The clear bonus is paid as soon as a wave has finished spawning. Normal wave announcements use a compact pill. A first-enemy introduction uses a small wave label, larger enemy name and icon, and one short counter-tip with a subtle enemy-color accent. Final and boss wave labels stay red.

## Maps

### Sector 1: Reactor Row

- One winding road with 8 rounded turns. Enemies enter through a broken gate on the left and travel to the reactor on the right (about 2,500 px of road; it starts off-screen).
- 10 fixed platforms, each beside 1 to 3 road segments. The central platforms (index 1 and 5) cover the most road.
- Decoration: ruined buildings with flickering neon signs, wrecked vehicles, streetlights (some broken), rubble, pipes, tanks and barriers. All of it is baked into one background texture and kept dark so combat stays readable.

### Sector 2: Twin Gates

- Two gates on the left (north and south) feed roads that merge at the centre-left into one trunk winding to the reactor. Platforms between the gates cover both lanes.
- Scenery is placed procedurally (seeded) around the roads.

### Sector 3: The Long Road

- One long serpentine across three rows (about 3,600 px of road), with platforms between the rows covering two stretches each.
- Scenery is placed procedurally (seeded).

### Sector 4: Crossfire Junction

- Two gates on the left. The north road (lane 0) runs along the top, loops down and back up, and enters the reactor from the left. The south road (lane 1) cuts straight across that loop, so the two roads **cross twice** (box junctions at (600, 380) and (930, 380)). It then swings down and enters the reactor from below. Both roads are about 2,000 px on screen and never merge.
- Every machine uses only one road, so each tower sees about half the traffic. That's why the sector starts with 500 credits, pays bigger clear bonuses and has a low `difficulty` (1.15). The **junction platforms** (the four quadrants around each crossing, 80 px from both roads) cover both lanes and are the key spots.
- Groups without a `lane` alternate roads. Wave 4 sends its Juggernaut and Repair Drones down the north road and its drones down the south road. In wave 6 the Spawner and Repair Drones take the north road and the runners the south road. In the finale the Titan and its Repair Drones take the north road and the Juggernauts the south road.
- All six towers. The wave beacon sits between the two gates. Scenery is procedural (seeded). `MapDef.junctions` makes the background paint all asphalt before any markings, with a hazard-hatched box at each crossing.

### Waves (Sector 4)

| Wave | HP × | Enemies | Theme | Clear bonus |
| --- | --- | --- | --- | --- |
| 1 | 1.30 | 16 | Drones | 30 |
| 2 | 1.40 | 15 | **Repair Drones introduced** behind a drone pack | 40 |
| 3 | 1.50 | 14 | **Burrowers introduced** + runners | 50 |
| 4 | 1.65 | 19 | Juggernaut with a repair escort (north), drones (south) | 60 |
| 5 | 1.80 | 10 | Specters + Burrowers | 65 |
| 6 | 1.95 | 21 | Spawner + repair escort, runners, Burrowers | 80 |
| 7 | 2.10 | 12 | Juggernauts, Repair Drones, Specters | 85 |
| 8 | 2.25 | 24 | Burrowers, Juggernauts, drones | 100 |
| 9 | 2.45 | 16 | Spawners, Repair Drones, Specters, Juggernauts | 105 |
| 10 | 2.70 | 30 | Juggernaut column, Burrowers, Repair Drones, runners | 115 |
| 11 | 2.85 | 27 | Everything at once | 145 |
| 12 | 3.30 | 45 | **Finale:** Titan + 4 Repair Drones (north), 4 Juggernauts (south), 10 Burrowers, Specters, drones | — |

## Interface

- **HUD (top left, pinned to the screen edge):** three columns (WAVE n/total with progress markers, REACTOR HP, CREDITS).
- **Controls (top right):** fullscreen (outside Poki only), sound, speed (1x/2x), pause.
- **Wave beacon (near the road entrance):** shows the countdown ring and the early-call bonus. It always starts the next wave when tapped.
- **Wave banner (top edge):** "WAVE n / total", plus a NEW-enemy line with an icon and tip when a type first appears.
- **Build drawer:** one card per tower the sector allows (4–6), showing name, icon, cost and a short role. Unaffordable cards are greyed out and their cost turns red. The drawer docks at the top or bottom, whichever is away from the selected platform.
- **Upgrade panel:** stat columns (current → next), perk line, Upgrade button with cost, Sell button with refund. The map shows the current range and, faintly, the next level's range.
- **Sector select:** a 2×2 grid of cards (schematic preview on the left; sector number, name, twist, wave count and best stars on the right), a lock on each locked sector, and one "what's new" chip: NEW TOWER, or the new machines when a sector adds no tower (Sector 4).
- **Pause:** one filled cyan Resume button, wave/reactor summary, quiet Sound/Restart/Main menu links, and an optional Challenges view. Endless shows the personal-best wave instead of Challenges. P / Esc resumes; restart keeps the overlay locked while its ad break resolves.
- **Result:** compact summary with the outcome, campaign stars (or wave reached on defeat), two key stats, and one primary action: NEXT SECTOR on victory, RETRY on defeat, or PLAY ENDLESS after Sector 4. Menu, Run details and Workshop are quiet footer links. Run details holds all five stats, challenge rewards, REPLAY SECTOR and TRY ENDLESS. Available rewarded REVIVE remains beside an equal-size RETRY with a video icon and explicit ad label.

### Tutorial (first run, Sector 1 only; never blocks)

Playtests showed players want to start immediately, so the tutorial is hints only: a bouncing hand pointer, a tap ripple and 2–3 big words. It doesn't pause anything and has no text boxes, buttons or Skip.

1. Hand on a platform: **"Tap to build"**.
2. Hand on the Pulse card: **"Pick a tower"**. If the menu is closed without building, it goes back to step 1.
3. Hand on the beacon: **"Start the wave!"**

The hints disappear (and the tutorial counts as done) as soon as wave 1 starts, whether from the beacon, the countdown or the Space key. The beacon always works. Wave 1 starts at most 6 seconds after the first tower is built.

### Build nudge (until Sector 1 is cleared; never blocks)

The v1.2.0 player fit test showed most players stop building after one or two towers: they leave during wave 2 (19% of players reaching it) or get overrun at waves 4 and 8. `ui/BuildNudge.ts` points at the next useful action with the same hand and big words:

- **"Build a tower!" / "Build another tower!"** on the empty platform that covers the most road, when the player can afford the cheapest tower.
- **"Upgrade a tower!"** on the cheapest affordable upgrade, once every platform is used.

It waits 4 s after the opportunity appears (so players can act on their own), stays up at most 8 s, then keeps quiet for 20 s if ignored. It hides during the tutorial, the hack hint, a hack lock, pause, game over and while a build/upgrade drawer is open. It only runs for players who haven't cleared Sector 1 yet. Game Events: `nudge / build|upgrade` with `shown` and `followed`.

## Scoring and progression

- **Stars on victory:** rated on reactor HP *lost*: 3 stars for at most 2 lost, 2 for at most 10, otherwise 1 (with the base 20 HP this is the old 18 / 10 thresholds; Reactor Plating adds a cushion without moving them). Best stars are saved per sector (up to 12 in total).
- **Unlocks:** a sector unlocks once the previous one is cleared.
- **Saved:** stars per sector, completed challenges, Workshop upgrades, best wave reached, total wins, mute and speed settings, tutorial completion.

### Workshop (v1.2.0)

Stars are also a currency. Stars earned = sector stars (up to 12) + completed challenges (up to 8), so 20 in total. They are spent in the **Workshop** (`WorkshopScene`, data in `data/perks.ts`) on permanent upgrades. The loop it supports: lose → upgrade → retry.

| Perk | Levels (cost in stars) | Effect per level |
| --- | --- | --- |
| Bigger Budget | 3 (1, 2, 3) | +25 starting credits |
| Wave Bounty | 2 (1, 2) | +25% wave clear bonus |
| Salvage Crew | 2 (1, 2) | Sell refund +10% (70% → 80% → 90%) |
| Spare Charge | 1 (2) | Start with 2 hack charges instead of 1 |
| Reactor Plating | 2 (2, 3) | +2 reactor HP |

Everything costs 19 stars, so players who complete nearly everything can buy it all. RESET (two taps) refunds every star. The WORKSHOP button appears on the menu, sector select and result screens once the player has earned a star; from a result screen the Workshop offers RETRY SECTOR N. Balance numbers in BALANCING.md are measured **without** perks; perks only make things easier.

### Endless mode (unreleased)

Unlocks once Sector 1 is cleared. It is reached from the **ENDLESS** strip under the sector cards: pick any cleared sector's map, and waves never stop. It exists for playtime: engaged players can keep going long after a campaign sector would end.

- **Waves** come from `data/endless.ts` (deterministic per map + wave number). Enemies join the pool as waves climb: Drones 1, Runners 3, Juggernauts 5, Specters 7, Spawners 9, Repair Drones 12, Burrowers 14. Every 10th wave is a **boss wave** with Titans (one per 10 waves) and, from wave 20, a Repair Drone escort. HP scale: 1 + 0.13·(n−1) + 0.0035·(n−1)². Clear bonus 30 + 4n (max 120). 12 s between waves (and the usual 3 s once the field is clear).
- **Per-map difficulty** (map geometry differs): Sector 1 map 1.0, Sector 2 1.1, Sector 3 1.6, Sector 4 1.3. Start credits: at least 400.
- **Rewards:** best wave per map is saved and shown (sector select, picker, menu). One Workshop star each when the best run on any map reaches waves **10, 20 and 30** (3 stars, so 23 stars in total with sectors and challenges). Workshop perks apply in Endless too.
- **Result screen:** "NEW BEST!" or "RUN OVER", wave reached and personal best, machines destroyed, time survived, and a short summary of new milestone stars. Run details holds the milestone breakdown. RETRY restarts Endless on the same map; the Workshop offers RETRY ENDLESS.
- **Ads:** as everywhere: a commercial break when a run starts or restarts, the opt-in revive after a loss, never mid-run. No tutorial, challenges or build nudge in Endless.

### Challenges (v1.2.0)

Each sector has two optional challenges (`data/challenges.ts`), each worth one Workshop star, once. The pause menu's Challenges view shows their current progress and whether victory is required.

| Sector | Challenges |
| --- | --- |
| 1 | Hack 3 machines · Call 3 waves early |
| 2 | Get a x4 combo · Win without selling a tower *(win)* |
| 3 | Win with 9 towers or fewer *(win)* · Land 4 perfect hacks |
| 4 | Get a x6 combo · Call 5 waves early |

Skill challenges (hacks, perfect hacks, combos, early calls) count even when the run is lost, so first-time players who lose Sector 1 still earn stars to spend. *(win)* challenges need a victory. "Calling early" means starting a wave from the beacon or Space while the next-wave countdown is running (not before wave 1).
- **Victory screen:** NEXT SECTOR (with a commercial break), REPLAY or MENU. Clearing the last sector (Sector 4) shows CAMPAIGN COMPLETE.
- **Revive after defeat:** once per run, an optional rewarded ad gives +10 reactor HP and clears the field.

## Art direction

- **Style:** 2.5D top-down neon cyberpunk, roughly 70% dark metal and 30% neon accents.
- **Palette:** background `#0B1020`, metal `#19243A`, raised surfaces `#28364F`, cyan `#00E5FF`, pink `#FF3DAE`, orange `#FF9B32`, purple `#A78BFA`, green `#4DFF88`, enemy red `#FF526F`.
- **Tower anatomy:** extruded octagonal foundation, raised armor plate, neon strips, bolts, vents and seams, an illuminated core, and a rotating weapon with a drop shadow. The Tesla tower is a tall pylon with coils and a floating orb.

## Audio

All sound effects are synthesized with Web Audio: placement, upgrade, sell, the shot for each tower type, explosion, tesla crackle, laser charge and fire, kill, shield break, reactor hit, wave start, UI click, victory and defeat.

Each sound is rate-limited and the total number of simultaneous sounds is capped. Audio starts only after the first user interaction and is suspended during ads and while the tab is hidden.
