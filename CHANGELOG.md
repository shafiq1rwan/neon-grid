# Changelog

## Unreleased

### Added
- 3-sector campaign: Reactor Row, Twin Gates (two attack lanes) and The Long Road (12 waves with a Titan boss finale). Sector select screen, per-sector stars and unlocks, NEXT SECTOR on victory.
- Titan War Machine boss enemy.
- Cryo Tower (sixth tower): area frost pulse that slows machines and makes them take +15% damage.
- Per-sector tower unlocks (Sector 1: four towers; Laser unlocks in Sector 2; Cryo in Sector 3) with a "NEW TOWER UNLOCKED" reveal. The build drawer adapts to 4–6 towers.
- Multi-lane roads, per-sector difficulty multiplier and start credits, and seeded procedural scenery for new maps.
- `npm run package` builds and zips the game for upload (`release/`).
- Poki submission kit (`docs/POKI_SUBMISSION.md`).
- Full-screen scaling on any aspect ratio, a fullscreen button and auto-fullscreen on phones (outside Poki).

### Changed
- The revive screen follows Poki's rewarded-ad rules: a 🎬 icon, a gold (not green) button, and an equal-size Retry beside it. No revive is offered without a working ad SDK.
- Menu, HUD, build drawer, wave banner and upgrade panel redesigned.

### Fixed
- The Space shortcut (next wave) did nothing.
- The game stayed small after rotating a phone from portrait.

## 1.0.0 — 2026-10-09

First complete release.

### Added
- Phaser 3.90 + TypeScript (strict) + Vite project; static production build.
- Map "Sector 7 — Reactor Row": a winding road, 10 build platforms, a ruined neon city and an animated reactor.
- Five towers with 3 visual and stat levels each: Pulse, Cannon, Missile, Tesla, Laser.
- Five enemy types plus spawned swarmlings: Drone, Rift Runner, Juggernaut (armored), Shielded Specter, Swarm Spawner.
- Damage model with shields, flat armor and piercing attacks; "first" targeting.
- Ten waves with new-enemy introductions, wave-clear bonuses and an early-call bonus.
- HUD, build drawer, upgrade/sell panel, pause menu, victory and defeat screens with a star rating.
- Skippable first-run tutorial.
- Procedural Canvas2D art baked into textures; pooled projectiles and effects.
- Web Audio synthesized sound effects with mute.
- Saves to LocalStorage: settings, tutorial completion, best stars, best wave, wins.
- Poki SDK adapter: loading, gameplay events, commercial breaks, rewarded revive.
- Mouse, touch and keyboard controls; full-screen responsive scaling (EXPAND); portrait rotate prompt.

### Balance
- Tuned with scripted-player runs (see `docs/BALANCING.md`).
