# Balancing Guide

All gameplay numbers are data-driven. You should rarely need to touch system code to rebalance.

| File | What it controls |
| --- | --- |
| `src/game/config.ts` → `ECONOMY` | Starting credits, sell refund, early-call bonus, reactor HP |
| `src/game/config.ts` → `WAVE_TIMING` | First countdown, gap between waves |
| `src/game/data/towers.ts` | Cost, damage, fire interval, range, splash, chains, warm-up, shield multiplier, piercing, turn rate |
| `src/game/data/enemies.ts` | HP, shield, armor, speed, reward, leak damage, spawner behaviour |
| `src/game/data/waves.ts` | Per-sector wave lists: groups (type, count, interval, delay, lane), `hpScale`, `clearBonus` |
| `src/game/data/maps.ts` | Per-sector `difficulty` (HP and shield multiplier), `startCredits`, platforms |

## Design targets

| Player behaviour | Intended outcome |
| --- | --- |
| Mixed towers + regular upgrades | Wins with about 15–18 HP (2–3 stars) |
| Builds a mix but never upgrades | Loses around wave 8–9 |
| Spams one tower type (Pulse) and upgrades it | Can win, but Juggernauts leak through; about 12–15 HP |
| Sector length | About 6–8.5 minutes of game time at 1x; about 20 minutes for the campaign |

The same targets apply to every sector, and later sectors may be tighter. Poki's playtests look for at least 3 minutes of play, so every sector should stay above that even at 2x speed.

### Last bot validation (v1.0.0)

Simulated with a scripted player at 6x simulation speed:

| Strategy | Result |
| --- | --- |
| Mixed with upgrades | Victory, 17 HP (only early runner leaks) |
| Mixed, no upgrades | Defeat on wave 8 |
| Pulse only with upgrades | Victory, 14 HP (Juggernaut leaks on waves 7–8) |

### Hacking validation (v1.1.0)

The bot's "hacker" strategy hacks the highest-HP hackable machine whenever it has the charges, and taps inside the PERFECT window. It's a perfect-play upper bound.

| Sector (difficulty) | No hacking (mixed + upgrades) | Perfect hacker | Hacks / perfects |
| --- | --- | --- | --- |
| 1 Reactor Row (1.19, before v1.1.2) | Victory, 13 HP | Victory, 18 HP | 19 / 14 |
| 2 Twin Gates (1.4) | Victory, 10 HP | Victory, 20 HP | 20 / 15 |
| 3 The Long Road (1.84) | Victory, 5 HP | Victory, 14 HP | 17 / 15 |

**What it took to get here:**
- The first tuning had a charge every 12 kills plus one every wave start, and a 600 × HP-scale blast cap. The hacker went flawless on every sector with about 35–40 hacks.
- Hacking is effectively a "remove the leaker" button, so the number of charges matters more than blast size.
- The final tuning: 28 kills per charge, a charge every 3rd wave, Juggernauts cost 2, a 380 cap, and +8% sector difficulty.

**Levers:** everything is in `HACK` in `config.ts`, plus the per-sector `difficulty`. Players who never hack must still be able to win every sector.

### v1.1.2: Sector 1 rebalanced from real-player data

The web fit test's Game Events showed the bot was a much better player than real players. Of 6,006 players who started Sector 1, only 22% cleared it. At wave 8, 913 of 2,736 (33%) lost, and waves 9 and 10 each lost another ~20%. The weak bot strategies reproduced this: "noup" (no upgrades) and "pulse" (Pulse only) both lost Sector 1 at wave 10.

Changes: waves 6–10 flattened (HP × 1.64/1.82/2.0/2.22/2.3 → 1.56/1.64/1.64/1.86/1.98), fewer Juggernauts in waves 7–8 (2+2 → 1+1), fewer Specters in waves 7–10, wave 8's groups spread out, slightly bigger clear bonuses, and Sector 1 `difficulty` 1.19 → 1.05. Waves 1–3 got an 8 s gap (players left during the slow early waves).

| Sector 1 strategy | Before | After |
| --- | --- | --- |
| noup (no upgrades) | Defeat at wave 10 | Victory, 15–17 HP (3 runs) |
| pulse (Pulse only) | Defeat at wave 10 | Victory, 17–20 HP (3 runs) |
| mixed + upgrades | Victory, 15 HP | Victory, 20 HP |
| perfect hacker | Victory, 16 HP | Victory, 20 HP |

Target for Sector 1: the weak strategies win comfortably, because real players are weaker than the bot. Sectors 2 and 3 were not changed: their per-wave fail rates in the fit test were low (players who reach them mostly finish).

### v1.2.1: Sector 1 from the v1.2.0 player fit test

The v1.2.0 player fit test (5m 23s average, vs 4m 56s for v1.0.1) still showed only 22% of players clearing Sector 1. 19% of players reaching wave 2 left during it, 12% lost at wave 4 and 29% at wave 8. The bot fills every platform; real players build one or two towers and stop. Changes: a build nudge (see GAME_DESIGN.md), waves 1–3 shorter with bigger clear bonuses (35/40/40), wave 4 with 12 Runners instead of 16 (HP × 1.28), and 3 Specters instead of 5/4 in waves 7–8.

| Sector 1 strategy (v1.2.1) | Results |
| --- | --- |
| noup (no upgrades) | Victory 17, 20, 20 HP |
| pulse (Pulse only) | Victory 20, 17 HP |
| mixed + upgrades | Victory 20 HP |

No leaks in waves 1–4 for any strategy; the bots afford about 5 towers by wave 4 (4 before).

### Endless mode (unreleased)

Bot (`mixed` = builds everything and upgrades, no hacking), waves reached and game time at 1x:

| Map (Endless difficulty) | mixed | other |
| --- | --- | --- |
| Sector 1 (1.0) | wave 23 (~11.6 min) | noup: wave 11 (~4.7 min); hacker: wave 23 |
| Sector 2 (1.1) | waves 23, 24 (~12 min) | noup: wave 23 |
| Sector 3 (1.6) | wave 25 (~12.6 min) | |
| Sector 4 (1.3) | waves 23, 23 (~12 min) | |

Target: a strong player lasts about 20–25 waves (~12 min) on every map, and even weak builds reach the wave-10 star. Sector 2's map is very sensitive (1.25 → wave 14, 1.0 → waves 27–29). Tune with `MAP_DIFFICULTY` and `endlessHpScale` in `data/endless.ts`. The Endless bot is `bot2.mjs` started with `{ mapIndex, endless: true }` and a longer time limit.

### v1.2.3: denser waves

From the v1.2.2 fit test: progress improved but playtime stayed flat, because faster pacing shortened runs. Light machines now come 1.35× as many at 0.75× HP with kill rewards × 1/1.35. Tuning lessons:
- Without the reward scaling, the extra kills paid ~35% more credits and the game got much easier (Sectors 2–4 ended with 17–20 HP).
- With reward scaling but 0.9× HP (1.22× total threat), Sectors 2–4 were lost.
- 0.75× HP with reward scaling keeps the threat and economy about equal:

| Sector | v1.2.2 (bot) | v1.2.3 (bot) | Sector time |
| --- | --- | --- | --- |
| 1 (noup / pulse) | 15–20 HP | 20 / 20 | +8% |
| 2 (mixed) | 6–10 HP | 13 / 13 (wave 6 softened) | +8% |
| 3 (mixed) | 2–6 HP | 12 / 15 | +6% |
| 4 (mixed / hacker) | 4–9 / 11 HP | 9 / 9 / 11 | +7% |
| Endless (mixed, maps 1–2) | wave 23–24 | wave 23 / 23 | +10% |

Sectors 2 and 3 end a little easier on purpose: they were the next walls in the fit test.

**Bot tips:** run at most 3 bots in parallel; more makes frames lag, which coarsens the 6x simulation and adds noise. Results vary by a few HP between runs, so use 3 runs. The leak log tags a leak with the wave that is current when it reaches the reactor, so leaks from wave N often show up as wave N+1.

### Sector 4: Crossfire Junction (Repair Drone, Burrower)

Sector 4 is the hardest sector. Players who reach it are skilled and may have Workshop upgrades. Targets: mixed + upgrades wins with about 4–10 HP, the perfect hacker wins with 10+ HP, and noup / pulse may lose.

Final tuning: `difficulty` 1.15, `startCredits` 500, clear bonuses about 30% above Sector 3's, hpScale 1.3 → 3.3 over 12 waves. Bot runs (3 per strategy, at most 3 in parallel, no Workshop perks):

| Strategy | Run 1 | Run 2 | Run 3 | Main leaks |
| --- | --- | --- | --- | --- |
| mixed + upgrades | Victory, 7 HP | Victory, 7 HP | Victory, 4 HP | wave 4 Juggernaut, wave 5 and 8 Burrowers |
| perfect hacker | Victory, 13 HP | Victory, 11 HP | Victory, 11 HP | 1 Juggernaut, 2–3 Burrowers (14–15 hacks, nearly all perfect) |
| noup (no upgrades) | Defeat, wave 8 | Defeat, wave 8 | Defeat, wave 9 | Burrowers, wave 6 Spawner, Juggernauts |
| pulse only | Defeat, wave 10 | Defeat, wave 12 | Defeat, wave 9 | Juggernauts (armor), finale Specters |

Bot game time is about 7:30 (mixed) to 8:05 (hacker) at 1x. Sectors 1–3 were re-run once each (mixed) after the change: 20 / 10 / 6 HP, the same as before.

**What it took to get here:**
- Two lanes that cross but never merge mean every tower sees only about half the machines (Twin Gates shares a trunk; Crossfire doesn't). The first version, at difficulty 1.9 with 380 credits and platforms about 140 px from the roads, lost on wave 4 even with perfect hacking. Moving platforms into the four quadrants of each junction (80 px from both roads), lengthening the south road to about 2,000 px, and changing the economy (500 credits, bigger clear bonuses) with a low `difficulty` fixed it.
- On this map, building wide beats upgrading early: at difficulty 1.0, noup did better than mixed. The late waves are therefore heavy on armor and HP (Juggernaut columns, Titan finale at hpScale 3.3) so that upgrades matter.
- Repair Drones first healed a flat 46 × HP scale. That fully healed drones every pulse, and the sector lost on wave 4. Now they heal 15% of the target's max HP, capped at 40 × the medic's HP scale (the finale Titan gets about 1.5% per pulse).
- Burrowers first spent about 53% of the road underground (up 3.2 s, under 190 px) and leaked in bulk. Now they're up 4 s, under 150 px, with 200 HP.
- **Very sensitive:** at difficulty 1.1 mixed won with 13–15 HP; at 1.2 it got 2 HP, lost on wave 8, and got 5 HP. Finale Burrower count and wave 8 Burrowers swing the result by about 4 HP each.

**Levers:** `heal` (fraction, cap, interval, radius) and `burrow` (surface, distance) in `enemies.ts`; Sector 4 `difficulty` / `startCredits` in `maps.ts`; `WAVES_SECTOR_4` in `waves.ts`. Workshop perks will make Sector 4 easier for returning players, so re-check with the perks the lead expects players to have.

**Bot note:** the hacker bot must skip `e.burrowed` machines when picking (`startLock` refuses them).

### Campaign bot validation (before hacking, v1.0.1)

| Sector | Mixed with upgrades | Mixed, no upgrades | Game time (mixed) |
| --- | --- | --- | --- |
| 1 Reactor Row (1.1, 4 towers) | Victory, 15 HP | Defeat on wave 10 | about 6:31 |
| 2 Twin Gates (1.3) | Victory, 15 HP | Defeat on wave 10 | about 6:42 |
| 3 The Long Road (1.7, with Cryo) | Victory, 6 HP | Victory, 7 HP (narrow) | about 8:24 |

Cryo first shipped weaker (slow only, 120 range) and the bot lost Sector 3 on wave 8 by spending prime platforms on it. The +15% "brittle" bonus and the extra range and slow fixed that. Watch Cryo's value whenever slows or ranges change.

The `difficulty` multiplier is very sensitive. For Sector 3, 1.45 gave flawless wins and 2.0 collapsed on wave 6.

Runs vary a little because of the random lateral lane offsets.

## Levers, from coarse to fine

0. **Hack supply (`HACK` in config.ts).** `killsPerCharge`, wave-start charges, `heavyCost` and `blastCap` swing every sector at once.
1. **Sector `difficulty` (maps.ts).** Scales the whole sector. Change it first when a sector is too easy or too hard overall.
2. **Wave `hpScale`.** The difficulty curve within a sector. Change neighbouring waves together so you don't create spikes.
3. **Economy** (rewards, `clearBonus`, `startCredits`). Very sensitive because it snowballs into upgrades. During tuning, about +20% rewards turned a loss on wave 10 into a flawless win.
4. **Wave composition.** Enemy counts and intervals. Short intervals concentrate pressure; overlapping groups (via `delay`) create spikes.
5. **Per-tower stats.** Use these to fix a dominant or useless tower, not overall difficulty.

## Watch-outs

- **Repair Drones multiply HP too.** With "first" targeting, towers shoot the front of a pack while a Repair Drone in the middle keeps healing it. Splash, chains and a hack on the medic are the counters. Keep `heal.cap` low, or escorted bosses become unkillable.
- **Burrowers dodge coverage.** Underground time is effective HP. Any coverage gap where they surface is a leak. Change `burrow.distance` together with HP.
- **Spawners multiply HP.** Each one releases `count` swarmlings every `interval` seconds for as long as it is alive. A spawner that survives the whole road can release about 25 swarmlings. Change `spawn.count` and `spawn.interval` carefully.
- **Armor punishes many small hits.** With armor 5, a Pulse Lv1 bolt (9 damage) does only 4. That is intentional, to push Cannon and Laser against Juggernauts.
- **Shield and health scale together** with `hpScale`, so late Specters get tough fast.
- **Waves overlap.** The next countdown starts once the current wave has *spawned*, not when it has been cleared. Late waves stack with the remains of the previous one.
- **Don't shorten `betweenWaves` blindly.** Cutting it from 14 s to 8 s made waves stack so much that the no-hack bot lost Sectors 1 and 2 (it had 13 and 10 HP left). Dead time is cut instead by `afterFieldClear` (next wave 3 s after the field is clear), which never adds overlap. Bot runs with it (no-hack / perfect hacker): Sector 1 13/20 HP, Sector 2 9/20, Sector 3 6/13, the same as before. The bot's defence never clears the field before the countdown ends, so its run times didn't change.
- The **early-call bonus** rewards confident players. If you raise `earlyCallBonusPerSecond`, the snowball gets stronger.

## Re-validating balance

To get a quick difficulty read after changing numbers, run a scripted bot from the browser console during development (the dev build exposes `window.__nwd`).

```js
const gs = __nwd.scene.getScene('GameScene');
gs.speed = 6; gs.tweens.timeScale = 6; gs.effects.setTimeScale(6); // fast simulation
```

Then build and upgrade through `gs.tapPlatform(i)`, `gs.buildTower(type)` and `gs.upgradeSelected()` on an interval. Log `gs.hp` whenever `gs.waves.index` changes. Test at least the three strategies in the table above, and record the results in this file.
