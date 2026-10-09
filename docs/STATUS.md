# Project Status & Handoff

Where the project stands, what's in flight and what to do next. Read this first when picking the project up on a new machine (or in a new AI-assistant session).

_Last updated: 2026-10-09 · version **1.0.1** (commit `d69637b`)_

## Set up on a new PC

1. Install **Node.js 20 or newer** (developed on Node 23; CI uses Node 22) and Git.
2. Clone and run:
   ```bash
   git clone https://github.com/shafiq1rwan/neon-grid.git
   cd neon-grid
   npm install
   npm run dev          # http://localhost:5173
   ```
3. Before committing, check: `npm run build` (type-check plus production build) must pass.
4. Build the Poki upload: `npm run package` → `release/neon-wasteland-defense-v<version>.zip`. `release/` is git-ignored, so rebuild it on each machine.

Nothing else is machine-specific: there are no asset files to download, no environment variables and no secrets. AI assistants should read [CLAUDE.md](../CLAUDE.md), which is the project's working notes. A Claude Code session's own memory stays on the old PC, so anything important is written into these docs.

## Where things are

| Thing | Location |
| --- | --- |
| Source repo | <https://github.com/shafiq1rwan/neon-grid> (branch `main`) |
| Live test build | <https://shafiq1rwan.github.io/neon-grid/>, auto-deployed by `.github/workflows/deploy.yml` on push to `main` |
| Poki upload zip | `npm run package` → `release/` |
| Static thumbnail | `output/marketing/poki-thumbnail.png` (1254², no text) plus the prompt used to generate it |
| Listing copy, categories, Poki checklist | [POKI_SUBMISSION.md](POKI_SUBMISSION.md) |

## What the game contains (v1.0.1)

- **Campaign:** 3 sectors, 32 waves, about 20 minutes in total.
  - Reactor Row: 10 waves, 4 towers, plus the tutorial.
  - Twin Gates: 10 waves, two lanes, unlocks Laser.
  - The Long Road: 12 waves, unlocks Cryo, Titan boss finale.
- **Towers:** six, each with 3 visual and stat levels: Pulse, Cannon, Missile, Tesla, Laser, Cryo.
- **Enemies:** Drone, Rift Runner, Juggernaut, Shielded Specter, Swarm Spawner (+ Swarmlings), Titan boss.
- **Progression:** per-sector stars (9 in total) and unlocks, a sector select screen, and NEXT SECTOR on victory.
- **Tutorial:** hint-only (hand pointer, 2–3 words). It never blocks play.
- **Poki:** SDK adapter, commercial breaks between runs, and a rewarded revive that follows Poki's button rules.
- **Screens:** full-screen on every aspect ratio (Phaser EXPAND), auto-fullscreen on phones outside Poki, rotate prompt in portrait.

Details: [GAME_DESIGN.md](GAME_DESIGN.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [BALANCING.md](BALANCING.md).

## Poki progress

| Step | Status |
| --- | --- |
| SDK integration verified in Poki Inspector | ✅ "SDK initialized" detected (it can take a few seconds on a slow connection) |
| v1.0.0 uploaded, first playtest | ✅ Done. Finding: about 5 players quit during the old blocking tutorial; they wanted to start immediately |
| Fix: hint-only tutorial, START always works, wave 1 starts about 6 s after the first tower | ✅ v1.0.1 |
| v1.0.1 playtest with the **Tower Defense** audience | ⏳ Waiting; the narrow audience fills slowly |
| Animated thumbnail (1080², 4–6 s, ≥ 50 fps, muted .mp4) | ⏳ Needed during Soft Release, before global release. Shot list in POKI_SUBMISSION.md §4 |
| Web Fit Test → Final review | Not started |

**When the playtest recordings arrive, check:**
- whether players tap a platform or START within the first 10 seconds,
- the sector and wave where each session ends, and the session length (it must stay above 3 minutes),
- any repeated taps or long pauses, which point to confusing UI.

## Backlog (prioritised)

1. **Cut dead time between waves.** About half of a sector's time at 1x is countdown.
   - Gap between waves 14 s → about 8 s (`WAVE_TIMING.betweenWaves`).
   - Auto-start the next wave about 3 s after the field is clear.
   - Remember the 2x speed choice across waves and sectors.
   - Keeps sectors at roughly 4–5.5 min, still above the 3-minute target.
2. **Make "call wave early" more visible:** a pulsing "+N credits" on the beacon and a one-time hint after wave 1.
3. **Active ability** (e.g. an orbital strike or EMP with a cooldown) so players have something to do between builds.
4. **A mini-boss mid-sector** (around wave 5) to break up the middle of each sector.
5. **Animated thumbnail** for Poki (see above).
6. **Thumbnail style:** the current one is more painterly than the in-game vector art. Regenerate it closer to the game if playtest or fit-test feedback suggests a mismatch.
7. **Mobile text:** the small role text on build cards is hard to read on phones (names, costs and icons are fine).
8. **Bundle size:** Phaser is about 340 KB gzipped of the about 380 KB zip. Only worth trimming if load times become an issue.

## Known caveats

- **Balance comes from a scripted bot, not real players.** Sector 3 is intentionally tight: the bot wins with 6–7 HP. The per-sector `difficulty` in `src/game/data/maps.ts` (1.1 / 1.3 / 1.7) is the main knob. See [BALANCING.md](BALANCING.md).
- **Outside Poki** (local dev and GitHub Pages), `PokiSDK.init()` may never resolve. The game boots after a 3 s timeout, shows no ads and hides Revive. In dev the SDK is skipped unless the URL has `?poki`.
- **Test tooling isn't in the repo.** The Playwright smoke tests and the balance bot were run from a temporary folder. The approach and console snippets are in [TESTING.md](TESTING.md) and [BALANCING.md](BALANCING.md), so they can be recreated with `playwright-core` and Edge/Chrome.
- **Phaser quirks with workarounds in place:**
  - A rotation resize bug, handled by `keepScaleInSync` in `main.ts`.
  - Phaser ignores keys whose default was already prevented. Use `input.keyboard.capture` in the game config, never a window-level `preventDefault`.

## Release routine

1. Make the change, then run `npm run build`.
2. Do a quick play check: `npm run dev` on desktop plus a phone-sized window.
3. Bump `version` in `package.json` and add a `CHANGELOG.md` entry.
4. `npm run package` → upload `release/neon-wasteland-defense-v<version>.zip` to [app.poki.dev](https://app.poki.dev). Optionally drag the unzipped build into the [Poki Inspector](https://inspector.poki.dev) first.
5. Commit and push. GitHub Pages updates automatically.
