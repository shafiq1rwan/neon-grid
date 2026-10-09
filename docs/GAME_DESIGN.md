# Game Design — Neon Wasteland Defense

## Pitch

The machines broke loose after a technological collapse. You control the last automated defense network in a ruined neon city. Build turrets on abandoned defense platforms, upgrade them, and stop ten waves of corrupted machines before they reach the energy reactor.

- **Genre:** fixed-placement tower defense (Kingdom Rush style placement, original mechanics and art)
- **Platform:** browser (Poki), desktop and mobile, mouse and touch
- **Session:** about 5–8 minutes for a full run
- **Goal clarity:** a player should understand "build on the glowing pads, protect the reactor" within 10 seconds

## Core loop

1. Tap a glowing platform, then pick a tower.
2. The wave starts, either from the countdown or by tapping the beacon.
3. Towers fire automatically. Destroyed machines drop credits.
4. Spend credits between and during waves on new towers or upgrades.
5. Survive all 10 waves and clear the field to win. If the reactor reaches 0 HP, you lose.

## Rules

| Rule | Value | Source |
| --- | --- | --- |
| Reactor HP | 20 | `ECONOMY.startingHp` |
| Starting credits | 220 (enough for 3 Pulse towers) | `ECONOMY.startCredits` |
| Sell refund | 70% of total investment | `ECONOMY.sellRefund` |
| First wave countdown | 35 s (frozen during the tutorial) | `WAVE_TIMING.firstWaveCountdown` |
| Gap between waves | 14 s after the previous wave finishes spawning | `WAVE_TIMING.betweenWaves` |
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

## Towers

Each tower has 3 levels. Every upgrade changes both the stats and the artwork (bigger weapon, more armor, more neon).

| Tower | Role | Attack | Special |
| --- | --- | --- | --- |
| **Pulse** (cyan) | Cheap starter, anti-runner | Fast homing bolts | — |
| **Cannon** (pink) | Anti-armor | Heavy shells, visible recoil | Piercing; Lv3 has twin barrels |
| **Missile** (orange) | Crowd control | Homing missiles | Splash damage, full in the inner 50% and 60% at the edge |
| **Tesla** (purple) | Shield breaker, groups | Instant chain lightning | Chains to nearby enemies with 0.85x damage per jump; 2x vs shields |
| **Laser** (green) | Sustained DPS | Continuous beam | Warm-up before damage; piercing; 1.5x vs shields |

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

## Waves

| Wave | HP × | Enemies | Theme | Clear bonus |
| --- | --- | --- | --- | --- |
| 1 | 1.00 | 8 | Drones | 20 |
| 2 | 1.10 | 16 | Drones (faster second group) | 25 |
| 3 | 1.20 | 16 | **Rift Runners introduced** | 30 |
| 4 | 1.32 | 28 | Runner pressure | 35 |
| 5 | 1.48 | 22 | **Juggernauts introduced** | 45 |
| 6 | 1.64 | 31 | Juggernauts + swarm | 50 |
| 7 | 1.82 | 22 | **Specters introduced** | 60 |
| 8 | 2.00 | 31 | Specters + runners + armor | 65 |
| 9 | 2.22 | 30 | **Swarm Spawners introduced** | 75 |
| 10 | 2.30 | 44 | Final mixed assault | — |

The clear bonus is paid as soon as a wave has finished spawning. A banner announces each wave, and when a new enemy type first appears it shows that enemy's icon and a counter-tip.

## Map: Sector 7, Reactor Row

- One winding road with 8 rounded turns. Enemies enter through a broken gate on the left and travel to the reactor on the right (about 2,500 px of road; it starts off-screen).
- 10 fixed platforms, each beside 1 to 3 road segments. The central platforms (index 1 and 5) cover the most road.
- Decoration: ruined buildings with flickering neon signs, wrecked vehicles, streetlights (some broken), rubble, pipes, tanks and barriers. All of it is baked into one background texture and kept dark so combat stays readable.

## Interface

- **HUD (top left):** wave number, wave progress chevrons and bar, reactor HP, credits.
- **Controls (top right):** sound, speed (1x/2x), pause.
- **Wave beacon (near the road entrance):** shows the countdown ring and the early-call bonus.
- **Build drawer:** 5 cards showing icon, name, cost, description and stat bars. Unaffordable cards are greyed out and their cost turns red. The drawer docks at the top or bottom, whichever is away from the selected platform.
- **Upgrade panel:** current to next stats, perk line, Upgrade button with cost, Sell button with refund. The map shows the current range and, faintly, the next level's range.
- **Pause, result and menu screens:** see `src/game/scenes/`.

### Tutorial (first run only, skippable)

1. Highlight a platform: "Tap the glowing platform".
2. Point at the Pulse card.
3. Explain the road and the reactor (GOT IT).
4. Point at the beacon: "START the first wave".

The wave countdown is frozen until the tutorial ends or is skipped.

## Scoring and progression

- **Stars on victory:** 3 for HP ≥ 18, 2 for HP ≥ 10, otherwise 1.
- **Saved:** best stars, best wave reached, total wins, mute setting, tutorial completion.
- **Revive after defeat:** once per run, an optional rewarded ad gives +10 reactor HP and clears the field.

## Art direction

- **Style:** 2.5D top-down neon cyberpunk, roughly 70% dark metal and 30% neon accents.
- **Palette:** background `#0B1020`, metal `#19243A`, raised surfaces `#28364F`, cyan `#00E5FF`, pink `#FF3DAE`, orange `#FF9B32`, purple `#A78BFA`, green `#4DFF88`, enemy red `#FF526F`.
- **Tower anatomy:** extruded octagonal foundation, raised armor plate, neon strips, bolts, vents and seams, an illuminated core, and a rotating weapon with a drop shadow. The Tesla tower is a tall pylon with coils and a floating orb.

## Audio

All sound effects are synthesized with Web Audio: placement, upgrade, sell, the shot for each tower type, explosion, tesla crackle, laser charge and fire, kill, shield break, reactor hit, wave start, UI click, victory and defeat.

Each sound is rate-limited and the total number of simultaneous sounds is capped. Audio starts only after the first user interaction and is suspended during ads and while the tab is hidden.
