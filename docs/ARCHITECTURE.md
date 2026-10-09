# Architecture

Phaser 3.90 + TypeScript (strict) + Vite. There are no external art or audio assets: everything is generated in code.

## Scenes

```
BootScene ──> MenuScene ──> GameScene ──launches──> UIScene
                 ^              │ (paused)
                 │              └──launches on game over──> ResultScene
                 └────────────── quit to menu ──────────────────┘
```

Scene order is set in `main.ts` and controls draw order (UIScene draws over GameScene, ResultScene over both). Phaser's `input.globalTopOnly` stops a tap on UI panels from also reaching the battlefield.

| Scene | Responsibility |
| --- | --- |
| `BootScene` | Bakes every texture (towers, enemies, effects, background), stores sign positions in the registry, calls `poki.gameLoadingFinished()`. |
| `MenuScene` | Title, tower showcase, Play / tutorial / sound toggles, best score. Runs a commercial break before starting a game. |
| `GameScene` | Owns the simulation and all systems. Exposes the player-action API (`tapPlatform`, `buildTower`, `upgradeSelected`, `sellSelected`, `callNextWave`, `toggleSpeed`, `pauseGame`, `resumeGame`, `revive`). |
| `UIScene` | HUD, build drawer, upgrade panel, tutorial, wave banners, pause overlay. Reads the game state every frame and listens to `GameEvents`. |
| `ResultScene` | Victory or defeat summary, stars, Revive (rewarded ad), Retry and Menu. |

**Scene instances are reused.** `GameScene.create()` resets every field, and each scene removes its listeners on `SHUTDOWN`. Restart with `gameScene.scene.restart()`; it relaunches UIScene itself.

## GameScene update order

```
dt = min(delta, 50ms) × speed
effects.beginFrame(dt)    clear shared Graphics, draw tesla arcs
waves.update(dt)          countdown / spawn groups
enemies.update(dt)        move along path, spawners, health bars, escapes
towers.update(dt)         targeting, aiming, firing, laser beams
projectiles.update(dt)    homing, impacts, splash
victory check
```

- **Game speed** scales `dt`, `tweens.timeScale` and each particle emitter's `timeScale`.
- **Pausing** calls `scene.pause()`, which freezes update, tweens and timers.
- **Hidden tab:** the game auto-pauses when the tab is hidden.

## Folder map

```
src/main.ts                 Phaser config, audio unlock, visibility handling, Poki init
src/game/config.ts          palette, depth layers, economy and timing constants, scene keys
src/game/data/              ALL tuning: towers.ts, enemies.ts, waves.ts, maps.ts
src/game/entities/          Tower (sprites + per-frame visuals), Enemy, Projectile (poolable)
src/game/systems/
  EnemySystem.ts            spawn, path following, damage model, kills, escapes, health bars
  TowerSystem.ts            build/upgrade/sell, per-attack-type firing logic
  ProjectileSystem.ts       pooled bolts/shells/missiles
  WaveSystem.ts             wave state machine (prewave → spawning → waiting → complete)
  EconomySystem.ts          credits
  TargetingSystem.ts        squared-distance queries (first, nearest, within)
src/game/rendering/
  CanvasKit.ts              Canvas2D helpers: prism extrusion, neon lines, cores, gradients
  TowerRenderer.ts          base / gun / icon textures per type × level
  EnemyRenderer.ts          enemy, shield bubble, spawner hatch textures
  EnvironmentRenderer.ts    full 1280×720 background + reactor parts
  EffectsRenderer.ts        FX textures and the runtime `Effects` class
src/game/ui/                widgets (NeonButton, panels, icons), HUD, TowerMenu, UpgradePanel, Tutorial
src/game/audio/             SoundSystem (Web Audio synth, singleton `sfx`)
src/game/platform/          PokiAdapter (singleton `poki`)
src/game/utils/             MathUtils (PathData, RNG, angles), ObjectPool, Storage (singleton `storage`)
```

## Rendering strategy

- **Bake once.** All vector art is drawn with Canvas2D at boot (`bakeTexture`). Glow comes from `shadowBlur`, computed once. At runtime only sprites draw. There are no shaders or post effects.
- **Towers** are a static `base` texture plus a rotating `gun` texture (and a black-tinted copy of the gun as its shadow) plus an additive `fx_glow` core. Upgrading swaps textures. The Tesla tower is one tall base texture plus a floating orb sprite.
- **Enemies** are one rotated sprite plus a shadow. Specters add a shield sprite; Spawners add a hatch glow.
- **One shared `Graphics` object** draws all transient lines (tesla arcs, laser beams) and is cleared each frame. **One more** draws every health bar.
- **Particles:** one emitter per colour, created lazily, using `explode()` / `emitParticleAt()`.
- **Pooling:** projectiles, shockwave rings, flashes and floating text are pooled.

### Depth layers (`DEPTH` in config.ts)

`BG 0 → AMBIENT → PLATFORM_HINT → RANGE → REACTOR → ENEMY_SHADOW → ENEMY → TOWER → PROJECTILE → EFFECT → BARS → FLOAT`

Enemies and towers add `y / 10000` and `y / 1000` respectively so that lower sprites overlap higher ones.

## Path following

`PathData` turns the corner list from `maps.ts` into a dense polyline with rounded corners and cumulative distances.

- Each enemy stores `dist` (distance travelled) and `seg` (its current segment). `sample(dist, out, seg)` therefore only scans forward from the last segment, which is O(1) per frame and allocation-free.
- Enemies get a random sideways offset within the lane so groups spread out across the road.

## Events (GameScene → UIScene)

These are defined in `GameEvents`: `selection`, `towerBuilt`, `waveStart`, `waveBonus`, `paused`, `resumed`, `gameOver`.

Continuous values (credits, HP, wave progress, countdown) are not sent as events. The HUD reads them every frame and only redraws a value when it has changed.

## Extending

### Add a tower

1. Add the type to `TowerType` and an entry in `TOWERS` / `TOWER_ORDER` (`data/towers.ts`).
2. Pick an `attack` kind. To add a new kind, handle it in `TowerSystem.updateTower`.
3. Draw it in `TowerRenderer.drawGun` (and `drawFoundation` if needed), and add a muzzle length in `Tower.ts` (`MUZZLE`).
4. Add a firing sound to `SfxName` and to `SoundSystem.play`.
5. If you add a sixth tower, recheck the card widths in `TowerMenu` (`CARD_W`).

### Add an enemy

1. Add the type and its stats to `data/enemies.ts`.
2. Draw it in `EnemyRenderer` and register its texture size in `ENEMY_TEX_SIZE`.
3. Optional: add idle motion in `EnemySystem.place`.
4. Use it in `data/waves.ts`. The wave banner introduces it automatically, using its `tip`.

### Add a map

Create a `MapDef` in `data/maps.ts` (road corners, platforms, reactor, buildings, props, seed). `SECTOR_7` is currently hard-wired in `BootScene`, `GameScene` and `MenuScene`. Supporting several maps means passing the map key through scene data and baking a `bg` texture per map.

## Performance notes

- No allocations in the hot loops except tesla arc point arrays (a few per second).
- Range checks use squared distances. There are 10 towers at most and roughly 60 enemies, so no spatial index is needed.
- `dt` is capped at 50 ms so a frame hitch can't teleport enemies.
- The production bundle is about 36 KB gzipped of game code plus about 340 KB gzipped of Phaser, split into its own chunk.
