# Neon Wasteland Defense

A 2D neon-cyberpunk tower defense game built with **Phaser 3**, **TypeScript (strict)** and **Vite**, intended for Poki.
Hold a ruined city's last reactor across a 3-sector campaign (32 waves, ending with a Titan boss). Each sector takes about 6–8 minutes.

**Picking this up on a new PC?** Start with [docs/STATUS.md](docs/STATUS.md): setup, current Poki progress and the backlog.

## Run

Requires Node.js 20+ and Git.

```bash
git clone https://github.com/shafiq1rwan/neon-grid.git
cd neon-grid
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
npm run package    # build + zip for Poki into release/
```

`npm run package` builds and zips the game into `release/neon-wasteland-defense-v<version>.zip` (index.html at the root), ready to upload to Poki.

`dist/` is a fully static site with relative asset paths, so you can upload it to any static host or zip it for Poki.

### Deploy to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes `dist/` on every push to `main`. You can also run it by hand from the Actions tab.

One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**. The game then appears at `https://<user>.github.io/<repo>/`. Asset paths are relative, so the repo subpath works.

## How to play

- PLAY starts Sector 1 straight away for new players. After that, PLAY opens the **sector select** screen (3 sectors, unlocked in order).
- Tap a glowing **platform** to open the build drawer, then tap a tower card to build it. Each sector offers its own set of towers (4 → 5 → 6).
- Tap a built tower to see its stats, its range, and the **Upgrade** (3 levels) and **Sell** (70% refund) buttons.
- Tap the red **beacon** near the road entrance to start the next wave early. You get bonus credits for every second left on the countdown.
- Top-right buttons: sound, game speed (1x/2x) and pause.
- Keyboard shortcuts: `Space` next wave, `1–6` quick build (in drawer order), `U` upgrade, `S` sell, `F` speed, `P`/`Esc` pause.

| Tower   | Role                                                     |
| ------- | -------------------------------------------------------- |
| Pulse   | Cheap, fast single-target bolts                          |
| Cannon  | Heavy shells with recoil; pierces armor                  |
| Missile | Homing missiles with splash damage                       |
| Tesla   | Arcs that chain between enemies; 2x damage to shields    |
| Laser   | Sustained beam after a warm-up; pierces armor (unlocked in Sector 2) |
| Cryo    | Frost pulse slows everything in range; frozen machines take +15% damage (unlocked in Sector 3) |

| Enemy                | Trait                                         |
| -------------------- | --------------------------------------------- |
| Corrupted Drone      | Basic                                         |
| Rift Runner          | Very fast, fragile, leaves a teal trail       |
| Wasteland Juggernaut | Huge HP and flat armor; looks damaged below 50% |
| Shielded Specter     | Energy shield absorbs damage first            |
| Swarm Spawner        | Releases swarmlings that follow the road      |
| Titan War Machine    | Sector 3 boss: massive armor, resists frost slow |

## Project layout

```
src/
  main.ts                    Phaser config, audio unlock, Poki init
  game/
    config.ts                palette, layers, economy and timing constants
    data/                    towers.ts, enemies.ts, waves.ts, maps.ts (all balance lives here)
    entities/                Tower, Enemy, Projectile
    systems/                 Enemy, Tower, Projectile (pooled), Wave, Economy, Targeting
    rendering/               Canvas2D art baked once into textures at boot
                             (TowerRenderer, EnemyRenderer, EnvironmentRenderer, EffectsRenderer)
    scenes/                  Boot, Menu, Sector (select), Game, UI (HUD overlay), Result
    ui/                      HUD, TowerMenu, UpgradePanel, Tutorial (hints), widgets
    audio/SoundSystem.ts     Web Audio synthesised SFX (no audio files)
    platform/PokiAdapter.ts  all Poki SDK calls, isolated from gameplay
    utils/                   MathUtils, ObjectPool, Storage, View (screen fitting), Fullscreen
scripts/package.mjs          zips dist/ into release/ (npm run package)
.github/workflows/deploy.yml GitHub Pages deploy on push to main
output/marketing/            Poki thumbnail + generation prompt
```

**Art:** there are no image or audio assets. All art is drawn procedurally with Canvas2D (gradients and baked glow) into cached textures when the game boots. At runtime the game only draws sprites plus one shared Graphics object for arcs and beams.

**Balance:** edit `src/game/data/*.ts`. Tower levels, enemy stats, wave composition and HP scaling are all data-driven.

## Poki integration

`PokiAdapter` uses only documented SDK v2 calls (https://developers.poki.com/guide/sdk-html5): `init`, `gameLoadingFinished`, `gameplayStart`/`gameplayStop`, `commercialBreak`, `rewardedBreak`.

- **Ad breaks:** `commercialBreak()` runs before each new run (Play, Retry, Restart). It never runs during combat. Audio is suspended while an ad plays.
- **Gameplay state:** gameplay start/stop follows pausing, the tab being hidden, game over and reviving.
- **Rewarded ad:** after a defeat, the player can watch a rewarded ad once to revive the reactor with +10 HP.
- **Local development:** the SDK is skipped in dev unless you add `?poki` to the URL. If the SDK is missing or blocked, the game runs standalone with no ads, and Revive is hidden (no reward without an ad).

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/STATUS.md](docs/STATUS.md) | **Start here:** new-PC setup, current Poki progress, backlog, release routine |
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | Rules, damage model, full tower/enemy/wave tables, UI, art direction |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Scenes, systems, rendering, events; how to add towers, enemies and maps |
| [docs/BALANCING.md](docs/BALANCING.md) | Tuning levers, design targets, bot validation results |
| [docs/POKI_INTEGRATION.md](docs/POKI_INTEGRATION.md) | SDK usage, event flows, ad rules, submission checklist |
| [docs/POKI_SUBMISSION.md](docs/POKI_SUBMISSION.md) | Poki listing copy, categories, thumbnails, upload zip, requirements checklist |
| [docs/TESTING.md](docs/TESTING.md) | Debug snippets and manual QA checklist |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

## Saved data

LocalStorage key `neon-wasteland-defense:v1` stores: mute setting, whether the tutorial is done, best stars per sector (`mapStars`, which also drives unlocks), best wave reached and the win count. Progress is per browser, so it doesn't follow you to a new PC.
