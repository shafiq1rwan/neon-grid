# Poki Integration

Reference: <https://developers.poki.com/guide/sdk-html5> (SDK v2).

All platform code lives in `src/game/platform/PokiAdapter.ts`, which exports the singleton `poki`. Gameplay code never touches `window.PokiSDK` directly.

## SDK loading

`index.html` includes the SDK script, as the Poki docs specify:

```html
<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>
```

`main.ts` runs `poki.init()` before creating the Phaser game.

| Situation | Behaviour |
| --- | --- |
| Production, SDK present | `PokiSDK.init()` is raced against a 3 s timeout. Ads are enabled only if init resolved. |
| SDK missing or blocked (ad blocker, offline, other host) | Standalone mode: every call is a no-op and the game still boots. |
| `npm run dev` | SDK skipped. Add `?poki` to the URL to test it locally. Outside Poki, `init()` may never resolve. |

## SDK calls used

Only documented functions are used.

| Call | Where | When |
| --- | --- | --- |
| `init()` | `main.ts` | Before the game is created |
| `gameLoadingFinished()` | `BootScene` | After all textures are baked |
| `gameplayStart()` | `GameScene.create`, `resumeGame`, `revive` | Active play begins or resumes |
| `gameplayStop()` | `pauseGame`, game over, quit to menu, before any ad | Play stops |
| `commercialBreak(cb)` | Menu **Play**, pause **Restart**, result **Retry / Play again** | Natural breaks only, never during combat |
| `rewardedBreak(cb)` | Result screen **Revive** button | Opt-in, after a defeat |

The adapter makes `gameplayStart()` and `gameplayStop()` idempotent, so duplicate calls are ignored.

### Event flows

These follow the sequences in Poki's docs.

```
Boot:          init → (bake textures) → gameLoadingFinished
Start run:     commercialBreak → gameplayStart
Pause/resume:  gameplayStop → … → gameplayStart
Tab hidden:    auto-pause → gameplayStop
Death+revive:  gameplayStop → rewardedBreak → (success) gameplayStart
Retry:         gameplayStop (game over) → commercialBreak → gameplayStart
```

## Audio and input during ads

- The `commercialBreak` and `rewardedBreak` callbacks call `sfx.suspend()`, which suspends the `AudioContext`. Audio resumes when the break promise settles.
- Keyboard shortcuts in `GameScene` are ignored while `poki.isAdPlaying` is true. The game is already paused or on the result screen whenever an ad can play.
- The tab visibility handler won't resume audio while an ad is playing.

## Rewarded ad

- **Reward:** revive with +10 reactor HP, and all enemies on the field are cleared. Once per run.
- **Disclosure:** the button reads "REVIVE · watch an ad for +10 HP", so the player knows an ad will play, as Poki requires.
- **Result:** the reward is granted only when `rewardedBreak()` resolves `true`. Otherwise the button changes to "Ad unavailable".
- **Standalone exception:** with no SDK at all, the revive is granted without an ad so the feature still works locally. Change `rewardedBreak()` in the adapter if a host requires otherwise.

## Fullscreen

Poki provides its own fullscreen control. The game's fullscreen button and the auto-fullscreen on PLAY only appear when the SDK isn't live (`poki.isLive` is false), for example on GitHub Pages.

## Submission checklist

- [ ] `npm run build` passes, and `dist/` works when opened through a static server.
- [ ] Drag `dist/` into the Poki Inspector and confirm the event order in its log.
- [ ] No ads during waves; breaks happen only at Play, Retry or Restart.
- [ ] Sound is muted during ads, and the mute setting persists.
- [ ] Touch controls work on mobile; portrait shows the rotate prompt.
- [ ] No console errors in production.
- [ ] The `window.__nwd` debug hook is absent from production (it is gated by `import.meta.env.DEV`).
- [ ] Relative asset paths (`base: './'` in `vite.config.ts`).
