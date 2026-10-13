# Changelog

## 1.1.1 — 2026-10-13

### Changed
- Phones held in portrait now play the game auto-rotated instead of showing a "rotate your device" screen. The game fills the screen sideways and touch input is mapped through the rotation; turning the phone to landscape switches back to the normal layout.
- Narrower upgrade panel (900 → 640 wide) so the stat cards fit their contents instead of stretching across the screen.

### Added
- Poki Game Events (`measure`): sector start/complete/fail, per-wave progress (`wave / s1-w01` …), the tutorial, and hacks by timing result, so the dashboard shows where players drop off.

### Fixed
- WebGL error "Framebuffer status: Incomplete Attachment" reported on Poki. When the host page briefly squeezed the game frame to a few pixels, the expand-to-fill scaling requested a canvas hundreds of thousands of pixels long. The game's internal size is now capped at 4096 px, and transient sliver layouts are ignored. Normal screens, including 4K, are unaffected.

## 1.1.0 — 2026-10-12

### Added
- **Hacking, the signature mechanic.** Tap a machine to start a timing lock: bullet time, a closing lock-on ring and a reactor data beam. Tap again in the window for a PERFECT HACK. Hacked machines turn cyan, walk back down the road and detonate in the horde.
  - Charges: start with 1, max 3; +1 per 28 kills and every 3rd wave. Juggernauts cost 2 and the Titan is immune.
  - HACK charge pill in the HUD, a one-time non-blocking hint (it retires after the first hack or 10 s on screen), and new effects and sounds.
- Bot-validated balance for hacking; sector difficulty raised about 8% (1.19 / 1.4 / 1.84).

### Changed
- Reduced the desktop tower catalogue to 1100×228px at 1280×720, with smaller cards, icons, and typography while retaining all six towers in one row.
- Rebalanced the 1280×720 drawers: centered vertical build-card contents, measured stat-row spacing, and equal action buttons with 8px vertical content padding and a 12px gap.
- Polished build and upgrade drawers with all available towers in one compact catalogue row and tower-specific upgrade comparisons. Upgrade/sell buttons have matching dimensions, centered label/price rows, and uniform padding and gaps. Restored proportional mobile scaling and the previous compact HUD after fixed screen-sized controls proved too large on cramped screens.
- Strengthened all six towers' upgrade silhouettes: larger Pulse capacitors, heavier Cannon armor and twin barrels, split Missile racks, wider Laser focusing hardware, taller Tesla side pylons, and larger Cryo crystal clusters. Added front level indicators, aligned projectile origins with weapon geometry, and fixed Tesla icon clipping.
- Revised the in-game Juggernaut tank with broader exposed tracks, a wedge hull, an angular turret, and a longer cannon. The Titan inherits the updated chassis, with both damaged variants retained.
- Added distance-driven tread animation, engine exhaust, and smoke that thickens below 25% tank health. Armor hits produce distinct sparks, and destroyed tanks shed armor fragments; the Titan has a larger blast. Effects respect pause and game speed, with capped smoke and debris particles.

## 1.0.1 — 2026-10-09

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
- Tutorial no longer blocks play (playtest feedback: players wanted to start immediately). It is now a hand pointer with 2–3 word hints, the START beacon always works, and wave 1 starts about 6 s after the first tower (first countdown 25 s instead of 35 s).
- Poki SDK: if `init()` finishes after the 3 s boot timeout (slow connection), ads and the rewarded revive are enabled from then on.
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
