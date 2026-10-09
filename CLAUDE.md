# Neon Wasteland Defense — working notes

A Phaser 3 + TypeScript (strict) + Vite tower defense game for Poki. There are no image or audio assets: art is drawn with Canvas2D at boot, and sound is synthesized with Web Audio.

## Commands
- `npm run dev`: dev server. Exposes `window.__nwd` (the Phaser game) for debugging.
- `npm run build`: runs `tsc --noEmit`, then `vite build`. It must stay error-free.
- `npm run typecheck`: types only.
- `npm run package`: build + zip into `release/` for the Poki upload. Bump `version` in package.json first.

## Current state
See `docs/STATUS.md` for version, Poki progress (playtests), backlog and the release routine. Keep it updated when status changes.

## Where things live
- Balance and content: `src/game/data/*.ts` (campaign sectors live in `MAPS` in `maps.ts`, with wave lists in `waves.ts`) and `ECONOMY` / `WAVE_TIMING` in `src/game/config.ts`.
- Simulation: `src/game/systems/`, orchestrated by `scenes/GameScene.ts`.
- UI: `scenes/UIScene.ts` plus `src/game/ui/`. It reads GameScene state each frame and listens to `GameEvents`.
- Art: `src/game/rendering/`. All textures are baked once in `BootScene`.
- Platform: all Poki calls go through `src/game/platform/PokiAdapter.ts`, never `window.PokiSDK` directly.

## Conventions
- The battlefield is 1280×720 in world coordinates. Phaser `Scale.EXPAND` grows the view to fill wider or taller screens, and every camera is centred on the battlefield (`utils/View.ts`). Pin edge UI with `viewBounds()`, never with `0` or `GAME_WIDTH`. The background is baked with `VIEW_PAD` of extra scenery.
- Scene instances are reused: reset every field in `create()`, and remove external listeners on `SHUTDOWN`.
- Don't call the field `game` inside a Scene subclass; it shadows `Phaser.Scene.game`. UIScene uses `gs`.
- Container hit areas are centred. For children laid out from the top-left, add a centred `Zone` as the hit target (see `TowerMenu`).
- Hot loops must not allocate. Use squared distances, pooled objects and the shared `Effects.gfx` for lines.
- Keep the palette in `COLORS` (config.ts) and about 70% dark metal / 30% neon.
- Ads only at natural breaks (Play, Retry, Restart, Next Sector) or the opt-in revive. Never during combat.
- Rewarded revive must keep Poki's rules: 🎬 icon, not green, an equal-size Retry beside it, and no reward unless `rewardedBreak()` resolved true (Revive is hidden when `poki.rewardedAvailable` is false).
- Campaign content is data: sectors in `MAPS` (paths/lanes, platforms, `towers` allowed, `difficulty`, `startCredits`, waves). Re-run a balance check after changing it (docs/BALANCING.md).
- The tutorial is hints only and must never block or pause play (playtest finding). The START beacon must always work.
- Keyboard: never `preventDefault` keys at window level, or Phaser ignores them. Use `input.keyboard.capture` in the game config.
- `keepScaleInSync` in `main.ts` works around a Phaser 3.90 resize-on-rotation bug; keep it.

## Docs
- `docs/STATUS.md`: start here. Status, Poki progress, backlog, new-PC setup.
- `docs/GAME_DESIGN.md`: rules and full stat tables. Update it when data changes.
- `docs/ARCHITECTURE.md`: scenes, systems, rendering, how to add towers, enemies and maps.
- `docs/BALANCING.md`: tuning levers and bot validation results.
- `docs/POKI_INTEGRATION.md`: SDK usage and submission checklist.
- `docs/POKI_SUBMISSION.md`: listing copy, categories, thumbnail specs, Poki requirements checklist.
- `docs/TESTING.md`: QA checklist and debug snippets.
