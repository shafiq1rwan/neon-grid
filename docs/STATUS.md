# Project Status & Handoff

Where the project stands, what's in flight and what to do next. Read this first when picking the project up on a new machine (or in a new AI-assistant session).

_Last updated: 2026-10-21 · version **1.2.0** (built for the last web fit test: Sector 1 rebalance, Workshop + challenges, Sector 4)_

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
4. Build the Poki upload: `npm run package` → `release/neon-wasteland-v<version>.zip`. `release/` is git-ignored, so rebuild it on each machine.

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

- **Local wave-clear celebration (2026-10-13):** medal, contextual congratulations, count-up stats, perfect-hack/combo highlights, sparks, and a success chime. Build and desktop/mobile browser checks pass, including automatic dismissal and next-wave cleanup. Previews: `output/wave-clear-desktop.png` and `output/wave-clear-mobile.png`.

- **Local art update (2026-10-12):** revised Juggernaut/Titan chassis and damaged textures for clearer silhouettes. Production build and browser texture checks pass; preview at `output/tank-design-preview.png`.
- **Local combat polish (2026-10-12):** animated treads, exhaust, damage smoke, armor-hit sparks, and tank destruction debris. Build and browser checks pass for frost slowdown, pause/resume, 2x effects, kill rewards, particle caps, and restart cleanup. Gameplay preview at `output/tank-polish-gameplay.png`.
- **Local tower polish (2026-10-12):** stronger upgrade silhouettes for all six towers, front level indicators, aligned muzzle origins, and more texture headroom for Cryo. Browser checks pass for all 18 levels, upgrade costs, texture swaps, rotated muzzle positions, and unclipped icons. Comparison at `output/tower-upgrades-preview.png`.
- **Local mobile polish (2026-10-12):** compact proportional drawers, all sector towers (4/5/6) in one catalogue row, tower-specific current/next comparisons, and equal action-button padding/spacing. Restored the previous HUD scale after fixed pixel sizing crowded small screens. All six card actions pass at 374×447, 844×390, and 1280×720. Preview: `output/tower-catalogue-374.png`.
- **Desktop spacing correction (2026-10-12):** centered build-card stacks, measured stat rows, and matching action buttons at 1280×720 (now 294×66px since the upgrade panel was narrowed to 640 in v1.1.1). Verified 8px top/bottom button padding and 12px action spacing across all tower levels. Preview: `output/mobile-upgrade-1280.png`.
- **Compact desktop catalogue (2026-10-12):** reduced to 1100×228px at 1280×720, keeping all six towers visible. Build, label-fit, and card-action checks pass on desktop and phone layouts. Preview: `output/tower-catalogue-1280.png`.

- **Campaign:** 4 sectors, 44 waves, about 30 minutes in total.
  - Reactor Row: 10 waves, 4 towers, plus the tutorial.
  - Twin Gates: 10 waves, two lanes, unlocks Laser.
  - The Long Road: 12 waves, unlocks Cryo, Titan boss finale.
  - Crossfire Junction (v1.2.0): 12 waves, two roads that cross twice, Repair Drones and Burrowers, Titan finale with a repair escort.
- **Towers:** six, each with 3 visual and stat levels: Pulse, Cannon, Missile, Tesla, Laser, Cryo.
- **Enemies:** Drone, Rift Runner, Juggernaut, Shielded Specter, Swarm Spawner (+ Swarmlings), Titan boss, and (Sector 4) Repair Drone and Burrower.
- **Progression:** per-sector stars (12) plus 8 challenges, spent in the Workshop on permanent upgrades (v1.2.0); sector unlocks, a sector select screen, and NEXT SECTOR on victory.
- **Tutorial:** hint-only (hand pointer, 2–3 words). It never blocks play.
- **Poki:** SDK adapter, commercial breaks between runs, and a rewarded revive that follows Poki's button rules.
- **Screens:** full-screen on every aspect ratio (Phaser EXPAND), auto-fullscreen on phones outside Poki. Portrait phones play auto-rotated (no rotate prompt) since v1.1.1.

Details: [GAME_DESIGN.md](GAME_DESIGN.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [BALANCING.md](BALANCING.md).

## Poki progress

| Step | Status |
| --- | --- |
| SDK integration verified in Poki Inspector | ✅ "SDK initialized" detected (it can take a few seconds on a slow connection) |
| v1.0.0 uploaded, first playtest | ✅ Done. Finding: about 5 players quit during the old blocking tutorial; they wanted to start immediately |
| Fix: hint-only tutorial, START always works, wave 1 starts about 6 s after the first tower | ✅ v1.0.1 |
| v1.0.1 **fit test** | ✅ **Passed**: 500 gameplays, average playtime **4m 56s** (took about 8 h to complete) |
| v1.1.0 with **Hacking** (signature mechanic, see [GAME_DESIGN.md → Hacking](GAME_DESIGN.md)) | ⏳ Built and bot-balanced. Next: upload and run a new fit test; keep v1.0.1 as the safe build |
| Animated thumbnail (1080², 4–6 s, ≥ 50 fps, muted .mp4) | ⏳ Needed during Soft Release, before global release. Shot list in POKI_SUBMISSION.md §4 |
| **Web Fit Test** (v1.1.x) | ❌ **Not accepted**: conversion to play **82.0%** (benchmark ~68%, good), average playtime **7:32** (benchmark ~9:57, too short), CTR from categories 2.4%. Game Events: only 22% cleared Sector 1; a third of players reaching S1 wave 8 lost there; ~24% left during waves 1–3 |
| v1.1.2: Sector 1 rebalance + faster start (fix for the above) | Folded into v1.2.0 (not uploaded on its own) |
| **v1.2.0** for the **last** web fit test retry: Sector 1 rebalance, Workshop + challenges, Sector 4 with two new enemies | ⏳ Built (`release/neon-wasteland-v1.2.0.zip`). Next: upload and request the final web fit test. Compare: S1 completion (was 22%), S1 w08 fails (was 33%), average playtime (was 7:32, target ~10:00) |
| Final review | Not started |

**Game Events (Poki dashboard → Game Events):** since v1.1.1 the game sends sector, wave, tutorial and hack events (list in [POKI_INTEGRATION.md](POKI_INTEGRATION.md#game-events-measure)). Builds before v1.1.1 only show `game / loading`. Use the wave funnel (`wave / s1-w01` …) to find the wave where players quit or fail most.

**When the playtest recordings arrive, check:**
- whether players tap a platform or START within the first 10 seconds,
- the sector and wave where each session ends, and the session length (it must stay above 3 minutes),
- any repeated taps or long pauses, which point to confusing UI.

## Backlog (prioritised)

0. **Fit-test v1.1.0 (Hacking).** Success means:
   - the test passes, with average playtime at or above the v1.0.1 baseline of **4m 56s**,
   - playtest recordings show players hacking within their first minute,
   - no single hack wipes a whole late wave, and players who never hack can still clear every sector.

1. ~~**Cut dead time between waves.**~~ Done (unreleased): the next wave starts 3 s after the field is clear, and 2x speed is remembered. The 14 s gap stays: 8 s made waves stack and the bot lost Sectors 1–2 (see BALANCING.md). Also added combo pop-ups and a "wave cleared" summary card.
2. **Make "call wave early" more visible:** a pulsing "+N credits" on the beacon and a one-time hint after wave 1.
3. **Overcharge** (a second active choice, cheap to build). An OVERCHARGE button in a tower's upgrade panel gives 5 s of double fire rate, then the tower overheats and is offline for 6 s (orange glow and smoke). Worth doing if playtests still show idle time between waves. Hacking already covers the old "active ability" idea.
4. **A mini-boss mid-sector** (around wave 5) to break up the middle of each sector.
5. **Animated thumbnail** for Poki (see above).
6. **Thumbnail style:** the current one is more painterly than the in-game vector art. Regenerate it closer to the game if playtest or fit-test feedback suggests a mismatch.
7. **Mobile UI playtest:** verify the compact tower catalogue and build/upgrade drawers on physical phones. Browser touch and layout checks pass.
8. **Bundle size:** Phaser is about 340 KB gzipped of the about 380 KB zip. Only worth trimming if load times become an issue.

## Known caveats

- **Balance comes from a scripted bot, not real players.** Sector 3 is intentionally tight: the bot wins with 6–7 HP. The per-sector `difficulty` in `src/game/data/maps.ts` (1.05 / 1.4 / 1.84) is the main knob. Real players are weaker than the bot: tune Sector 1 against the weak strategies (`noup`, `pulse`). See [BALANCING.md](BALANCING.md).
- **Outside Poki** (local dev and GitHub Pages), `PokiSDK.init()` may never resolve. The game boots after a 3 s timeout, shows no ads and hides Revive. In dev the SDK is skipped unless the URL has `?poki`.
- **Test tooling isn't in the repo.** The Playwright smoke tests and the balance bot were run from a temporary folder. The approach and console snippets are in [TESTING.md](TESTING.md) and [BALANCING.md](BALANCING.md), so they can be recreated with `playwright-core` and Edge/Chrome.
- **Phaser quirks with workarounds in place:**
  - A rotation resize bug, handled by `keepScaleInSync` in `main.ts`.
  - "Framebuffer status: Incomplete Attachment" on Poki, when the frame is briefly squeezed to a sliver. Fixed in v1.1.1 with `scale.max` 4096 and a minimum-size guard. Keep both.
  - Auto-rotate (`utils/AutoRotate.ts`) patches three Phaser internals on the game instance. Re-test portrait taps after any Phaser upgrade. Tested in emulated phones only so far; check on a real iPhone and Android before relying on it.
  - Phaser ignores keys whose default was already prevented. Use `input.keyboard.capture` in the game config, never a window-level `preventDefault`.

## Release routine

1. Make the change, then run `npm run build`.
2. Do a quick play check: `npm run dev` on desktop plus a phone-sized window.
3. Bump `version` in `package.json` and add a `CHANGELOG.md` entry.
4. `npm run package` → upload `release/neon-wasteland-v<version>.zip` to [app.poki.dev](https://app.poki.dev). Optionally drag the unzipped build into the [Poki Inspector](https://inspector.poki.dev) first.
5. Commit and push. GitHub Pages updates automatically.
