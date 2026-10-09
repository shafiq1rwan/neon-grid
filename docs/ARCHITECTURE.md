# Architecture

Phaser 3.90 + TypeScript (strict) + Vite. There are no external art or audio assets: everything is generated in code.

## Scenes

```
BootScene ──> MenuScene ──(new player)──────────────> GameScene ──launches──> UIScene
                 │  ^                                   ^  │ (paused)
                 │  │                                   │  └──launches on game over──> ResultScene
                 └──┼──(returning)──> SectorScene ──────┘        (Retry / Next Sector restart GameScene)
                    └──────────── quit to menu ─────────────────────────┘
```

Scene order is set in `main.ts` and controls draw order (UIScene draws over GameScene, ResultScene over both). Phaser's `input.globalTopOnly` stops a tap on UI panels from also reaching the battlefield.

| Scene | Responsibility |
| --- | --- |
| `BootScene` | Bakes every texture (towers, enemies, effects, background), stores sign positions in the registry, calls `poki.gameLoadingFinished()`. |
| `MenuScene` | Title, tower showcase, Play / sound / help, campaign stars. PLAY starts Sector 1 directly for new players, otherwise opens `SectorScene`. |
| `SectorScene` | Campaign sector select: schematic previews, locks, stars. Runs a commercial break before starting a sector. |
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

## Screen fitting

- **EXPAND mode.** `main.ts` uses `Phaser.Scale.EXPAND`, so the whole 1280×720 battlefield is always visible. The view grows sideways on wide phones (about 1558×720 on a 19.5:9 phone) or vertically on tablets (1280×960 at 4:3) to fill the screen with no black bars.
- **Centred cameras.** `centerCamera(scene)` in `utils/View.ts` centres every scene's camera on (640, 360), so world coordinates never change.
- **Edge-pinned UI.** The HUD panel, the top-right buttons and the build/upgrade drawers are placed with `viewBounds()`.
- **Background padding.** The background is baked with `VIEW_PAD` (380×140, enough for screens up to about 2.8:1) of extra scenery around the map, and the road starts at x = −440 so enemies enter off-screen. A screen-space `vignette` sprite is stretched over whatever is visible.
- **Fullscreen.** `utils/Fullscreen.ts` enters browser fullscreen when PLAY is tapped on touch devices, and the HUD shows a fullscreen toggle. This hides the address bar so the battlefield gets the whole screen. It is disabled on Poki, which has its own fullscreen, and on iPhone Safari, which doesn't support it.
- **Rotation fix.** `keepScaleInSync` in `main.ts` works around a Phaser 3.90 bug where rotating a phone left the canvas at its old size.

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
  EnvironmentRenderer.ts    per-map background (battlefield + VIEW_PAD scenery), reactor parts
  EffectsRenderer.ts        FX textures and the runtime `Effects` class
src/game/scenes/            Boot, Menu, Sector (campaign select), Game, UI, Result
src/game/ui/                widgets (NeonButton, panels, icons), HUD, TowerMenu, UpgradePanel, Tutorial (hints)
src/game/audio/             SoundSystem (Web Audio synth, singleton `sfx`)
src/game/platform/          PokiAdapter (singleton `poki`)
src/game/utils/             MathUtils (PathData, RNG, angles), ObjectPool, Storage (singleton `storage`),
                            View (EXPAND camera centring / viewBounds), Fullscreen (non-Poki fullscreen)
scripts/package.mjs         zips dist/ into release/<name>-v<version>.zip
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

1. Add the type to `TowerType` and an entry in `TOWERS` / `TOWER_ORDER` (`data/towers.ts`). Add role text to `ROLES` / `MOBILE_ROLES` in `TowerMenu.ts`.
2. Pick an `attack` kind (`bolt`, `shell`, `missile`, `chain`, `beam`, `frost`). To add a new kind, handle it in `TowerSystem.updateTower`, and in `perkLine` / `statValues` for the UI.
3. Art:
   - Rotating turrets: draw the weapon in `TowerRenderer.drawGun` and add a muzzle length in `Tower.ts` (`MUZZLE`).
   - Stationary towers (like Tesla and Cryo): bake a single base texture, and give them a branch in the `Tower` constructor, `pivotY` and `updateVisuals`.
4. Add a firing sound to `SfxName` and to `SoundSystem.play`.
5. Add it to a sector's `towers` list in `data/maps.ts`. The sector that first lists it shows the "NEW TOWER UNLOCKED" reveal and the sector-card chip automatically.
6. The build drawer sizes its cards to the sector's tower count. Check it on a phone if a sector offers more than 6.

### Add an enemy

1. Add the type and its stats to `data/enemies.ts`.
2. Draw it in `EnemyRenderer` and register its texture size in `ENEMY_TEX_SIZE`.
3. Optional: add idle motion in `EnemySystem.place`.
4. Use it in `data/waves.ts`. The wave banner introduces it automatically, using its `tip`.

### Add a map (campaign sector)

1. Add a wave list to `data/waves.ts`. Groups may pin a `lane` on multi-road maps.
2. Create a `MapDef` in `data/maps.ts` and append it to `MAPS`. It needs an id, name, subtitle, one or more `paths` (lanes sharing a trunk should repeat the same trunk points), platforms, reactor, `waveButton`, seed, waves, `difficulty` and `startCredits`.
   - Leave out `buildings` and `props` to get seeded procedural scenery that keeps clear of roads and platforms.
   - Keep platforms at least about 75 px from road centre lines, and keep the top-left HUD (x < 440, y < 100) and the top-right buttons (x > 960, y < 90) clear.
3. Nothing else is required. The sector select screen, unlocks, stars and the NEXT SECTOR button all read `MAPS`.

### How sectors load

- `GameScene.create({ mapIndex })` picks the sector and stores it in the registry, so `scene.restart()` (Retry / Restart) replays the same one.
- `ensureMapBackground()` bakes a map's background (`bg_<id>`) the first time it's shown and caches it. Only Sector 1 is baked at boot.
- Each lane is its own `PathData`. Enemies carry a `lane` index; spawners pass theirs to their swarmlings. `WaveSystem` round-robins lanes for groups without a fixed `lane`.

## Performance notes

- No allocations in the hot loops except tesla arc point arrays (a few per second).
- Range checks use squared distances. There are 10 towers at most and roughly 60 enemies, so no spatial index is needed.
- `dt` is capped at 50 ms so a frame hitch can't teleport enemies.
- The production bundle is about 36 KB gzipped of game code plus about 340 KB gzipped of Phaser, split into its own chunk.
