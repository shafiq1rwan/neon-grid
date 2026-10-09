# Changelog

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
- Mouse, touch and keyboard controls; responsive 16:9 scaling; portrait rotate prompt.

### Balance
- Tuned with scripted-player runs (see `docs/BALANCING.md`).
