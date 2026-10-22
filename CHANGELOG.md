# Changelog

## 1.2.1 — 2026-10-22

Based on the v1.2.0 player fit test (5m 23s; only 22% cleared Sector 1; 19% left during wave 2; 12% lost at wave 4 and 29% at wave 8).

### Added
- **Build nudge:** until Sector 1 is cleared, a hand and "Build another tower!" point at a good empty platform whenever the player can afford a tower (or "Upgrade a tower!" once every platform is used). It waits 4 s, never blocks, and backs off if ignored. Based on the v1.2.0 player fit test: players stopped building after 1–2 towers and then left at wave 2 or lost at waves 4 and 8. New Game Events: `nudge / build|upgrade` (`shown`, `followed`).

### Changed
- **Punchier opening:** Sector 1 waves 1–3 are shorter and pay bigger clear bonuses (35 / 40 / 40), so a second and third tower come within the first minute.
- **Softer real-player walls:** wave 4 has 12 Runners (was 16); the first Specter waves (7–8) have 3 Specters (was 5 and 4).
- **Sector 1 challenge "Land 2 perfect hacks" is now "Hack 3 machines"** (only 4 of ~500 players managed the old one), so most first-time players earn a Workshop star even if they lose.
- **After a loss, the WORKSHOP button pulses** with "Upgrade, then retry!" whenever there are stars to spend.
- **More satisfying feedback:** coins fly from every kill into the credits counter (the coin icon bounces), a small camera kick on building, upgrading and big kills, and a pop on the wave banner.
- New coaching pointer for the tutorial, hack hint and build nudge: a clean white glove with one outline, a neon cuff and a soft cyan glow (baked at 2× for crisp edges), replacing the old hand drawn from rounded boxes. On "Pick a tower" it points at the tower icon from the side, so the card's role and price stay readable.

## 1.2.0 — 2026-10-21

Built for the last web fit test retry: everything from 1.1.2 below, plus reasons to keep playing and replaying.

### Added
- **Workshop:** spend stars on permanent upgrades: Bigger Budget (starting credits), Wave Bounty (bigger wave bonuses), Salvage Crew (better sell refund), Spare Charge (+1 starting hack charge) and Reactor Plating (+HP). Reset anytime for a full refund. Opens from the menu, sector select and result screens; after a defeat it offers RETRY SECTOR.
- **Sector challenges:** two optional goals per sector (perfect hacks, combos, early calls, no selling, few towers), each worth a star. Shown with live progress on the pause screen. Skill challenges count even when you lose.
- **Sector 4 — Crossfire Junction:** two highways that cross twice, 12 waves, Titan finale with a repair escort.
- **Two new machines:** the Repair Drone heals nearby machines (focus it first) and the Burrower dives underground where towers can't reach it. New heal and burrow sounds.
- Game Events for challenges and Workshop purchases.

### Changed
- The game is now called **Neon Wasteland** (menu title, page title, upload zip). Saves carry over.
- Stars are rated on reactor HP lost (same thresholds at 20 HP), so Reactor Plating is a cushion, not a harder 3 stars.
- Sector select shows the four sectors in a 2×2 grid.

### Fixed
- A machine under a laser beam no longer stays solid white: the hit flash now pulses.

## 1.1.2 — 2026-10-21 (not released on its own)

Based on the web fit test (average playtime 7:32 vs a ~9:57 benchmark; only 22% of players cleared Sector 1, a third of those reaching wave 8 lost there, and about a quarter left during the slow first waves).

### Changed
- **Sector 1 is easier in its second half.** Waves 6–10 have less HP, fewer Juggernauts and Specters, and wave 8's groups are spread out; clear bonuses are slightly higher and the sector difficulty dropped from 1.19 to 1.05. Bot check: players who never upgrade now win with 15–20 HP (they used to lose at wave 10). Sectors 2 and 3 are unchanged.
- **Faster start.** Waves 1–3 of Sector 1 follow each other after 8 seconds instead of 14.
- Wave-clear cards now celebrate the player with a gold medal, contextual praise, animated stat totals, achievement callouts, a spark burst, and a short success chime.
- Less waiting: once the field is clear between waves, the next wave starts in 3 seconds. Balance is unchanged (bot-checked on all three sectors).
- The 1x/2x speed choice is remembered across waves, sectors and visits.

### Added
- "xN COMBO!" pop-up when one hack blast, missile splash or Tesla chain destroys 3 or more machines.
- "WAVE N CLEARED" card between waves: machines destroyed, credits earned, perfect hacks and best combo.

## 1.1.1 — 2026-10-13

### Changed
- Phones held in portrait now play the game auto-rotated instead of showing a "rotate your device" screen. The game fills the screen sideways and touch input is mapped through the rotation; turning the phone to landscape switches back to the normal layout.
- Narrower upgrade panel (900 → 640 wide) so the stat cards fit their contents instead of stretching across the screen.

### Added
- Poki Game Events (`measure`): sector start/complete/fail, per-wave progress (`wave / s1-w01` …), the tutorial, and hacks by timing result, so the dashboard shows where players drop off.

### Fixed
- The upgrade button could collapse into a thin green line when it became affordable while the panel was open. Buttons stored their width in a field Phaser resets to 0 on every move, so any later redraw drew a zero-width button.
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
