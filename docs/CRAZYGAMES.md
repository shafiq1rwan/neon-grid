# CrazyGames

Neon Wasteland was declined by Poki on 2026-11-26 after its web fit test (10:07 playtime, 77.6% conversion), so it is being prepared for CrazyGames. Their docs: https://docs.crazygames.com/

## Build

- `npm run package:crazygames` writes `release/neon-wasteland-v<version>-crazygames/` and a `.zip` of the same files. The CrazyGames uploader doesn't take zips: drag the folder's **contents** (`index.html` and the `assets` folder) into the upload area.
- It builds with `vite --mode crazygames`, which reads `.env.crazygames`:
  - `VITE_PORTAL=crazygames` selects `CrazyGamesAdapter` (`src/game/platform/`). The Poki adapter is left out of the bundle.
  - `VITE_SDK_URL` injects the CrazyGames SDK v3 script into `index.html` in place of the Poki SDK. CrazyGames forbids other portals' branding, so the build contains no Poki SDK or text.
  - `VITE_CG_ADS=false` keeps ads off. CrazyGames disables monetization in Basic Launch and forbids rewarded buttons that can't pay out, so Revive is hidden.
- Local test: `npx vite --mode crazygames`, then open `http://localhost:5173/?crazygames`. The SDK runs in its `local` environment: it logs every call and shows overlay text instead of real ads.

## What the adapter does

| Game call | CrazyGames SDK |
|---|---|
| `init()` | `SDK.init()` (3 s timeout, like Poki). If `environment` is `disabled` (any other host), the adapter stays inactive. Then `game.loadingStart()`. |
| `gameLoadingFinished()` | `game.loadingStop()` |
| `gameplayStart()` / `gameplayStop()` | `game.gameplayStart()` / `gameplayStop()` (Basic Launch needs `gameplayStart`). |
| `commercialBreak()` | `ad.requestAd('midgame')` when ads are on |
| `rewardedBreak()` | `ad.requestAd('rewarded')`. The reward is granted only on `adFinished`. |
| Audio | Muted on `adStarted`, not on request. `game.settings.muteAudio` and its change listener override the in-game sound toggle (`sfx.setHostMuted`). |
| `measure()` | No-op. CrazyGames has no Game Events equivalent. |
| Fullscreen | `hostFullscreen` is true, so the game's own fullscreen button never shows. CrazyGames forbids one. |

## Launch stages

1. **Submit**: the CrazyGames team runs a manual QA check (bugs, English, originality, PEGI 12).
2. **Basic Launch**: the game goes live for at least 7 days and 500 plays, ending at 21 days at the latest. There are no ads or revenue in this stage. It is scored on average playtime (strong: 10+ min), Day 1 retention (strong: 10–15%), conversion (a play of at least 1 minute; top games 80%+, load under 10 s, under 20 MB) and CTR (top 20% of the category).
3. **Full Launch**: the SDK and ads are required, with a revenue share paid monthly from €100.

## Before Full Launch

- Set `VITE_CG_ADS=true` and test midgame and rewarded ads in the `local` environment. `adblock` or `adsDisabled` errors hide Revive for the rest of the session.
- Data module: if "Progress Save" is enabled at submission, CrazyGames expects saves to go through `SDK.data` instead of plain localStorage (`utils/Storage.ts`).
- Check the midgame ad placements against their rules (no ads on navigation buttons). Today they run on Play, Retry, Restart, Next Sector and Workshop.
- Optional: `game.happytime()` for big moments (e.g. finishing the campaign).

## Submission notes

- Category: Tower Defense (or Strategy > Tower Defense). A wrong category hurts CTR.
- Orientation: landscape. Portrait phones play rotated (`utils/AutoRotate.ts`).
- The zip is about 0.4 MB, far below the 50 MB / 20 MB limits.
