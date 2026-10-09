# Balancing Guide

All gameplay numbers are data-driven. You should rarely need to touch system code to rebalance.

| File | What it controls |
| --- | --- |
| `src/game/config.ts` → `ECONOMY` | Starting credits, sell refund, early-call bonus, reactor HP |
| `src/game/config.ts` → `WAVE_TIMING` | First countdown, gap between waves |
| `src/game/data/towers.ts` | Cost, damage, fire interval, range, splash, chains, warm-up, shield multiplier, piercing, turn rate |
| `src/game/data/enemies.ts` | HP, shield, armor, speed, reward, leak damage, spawner behaviour |
| `src/game/data/waves.ts` | Groups (type, count, interval, delay), `hpScale`, `clearBonus` |

## Design targets

| Player behaviour | Intended outcome |
| --- | --- |
| Mixed towers + regular upgrades | Wins with about 15–18 HP (2–3 stars) |
| Builds a mix but never upgrades | Loses around wave 8–9 |
| Spams one tower type (Pulse) and upgrades it | Can win, but Juggernauts leak through; about 12–15 HP |
| Full run length | About 6 minutes of game time at 1x |

### Last bot validation (v1.0.0)

Simulated with a scripted player at 6x simulation speed:

| Strategy | Result |
| --- | --- |
| Mixed with upgrades | Victory, 17 HP (only early runner leaks) |
| Mixed, no upgrades | Defeat on wave 8 |
| Pulse only with upgrades | Victory, 14 HP (Juggernaut leaks on waves 7–8) |

Runs vary a little because of the random lateral lane offsets.

## Levers, from coarse to fine

1. **Wave `hpScale`.** The main difficulty curve. Change neighbouring waves together so you don't create spikes.
2. **Economy** (rewards and `clearBonus`). Very sensitive because it snowballs into upgrades. During tuning, about +20% rewards turned a loss on wave 10 into a flawless win.
3. **Wave composition.** Enemy counts and intervals. Short intervals concentrate pressure; overlapping groups (via `delay`) create spikes.
4. **Per-tower stats.** Use these to fix a dominant or useless tower, not overall difficulty.

## Watch-outs

- **Spawners multiply HP.** Each one releases `count` swarmlings every `interval` seconds for as long as it is alive. A spawner that survives the whole road can release about 25 swarmlings. Change `spawn.count` and `spawn.interval` carefully.
- **Armor punishes many small hits.** With armor 5, a Pulse Lv1 bolt (9 damage) does only 4. That is intentional, to push Cannon and Laser against Juggernauts.
- **Shield and health scale together** with `hpScale`, so late Specters get tough fast.
- **Waves overlap.** The next countdown starts once the current wave has *spawned*, not when it has been cleared. Late waves stack with the remains of the previous one.
- The **early-call bonus** rewards confident players. If you raise `earlyCallBonusPerSecond`, the snowball gets stronger.

## Re-validating balance

To get a quick difficulty read after changing numbers, run a scripted bot from the browser console during development (the dev build exposes `window.__nwd`).

```js
const gs = __nwd.scene.getScene('GameScene');
gs.speed = 6; gs.tweens.timeScale = 6; gs.effects.setTimeScale(6); // fast simulation
```

Then build and upgrade through `gs.tapPlatform(i)`, `gs.buildTower(type)` and `gs.upgradeSelected()` on an interval. Log `gs.hp` whenever `gs.waves.index` changes. Test at least the three strategies in the table above, and record the results in this file.
