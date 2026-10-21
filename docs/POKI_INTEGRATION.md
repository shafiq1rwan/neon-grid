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
| `measure(category, what, action)` | `GameScene`, `UIScene` (via `poki.measure`) | Game Events, see below |

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

## Game Events (`measure`)

Poki records `game / loading` by itself; everything else in the dashboard's **Game Events** tab comes from these calls ([Poki guide](https://developers.poki.com/guide/game-events)). Ads are tracked automatically, so they are not measured.

| Category / what | Actions | Sent when |
| --- | --- | --- |
| `level / sector-1` … `sector-4` | `start`, `complete`, `fail` | Every run of a sector (including Retry / Replay); victory; final defeat |
| `wave / s1-w01` … `s4-w12` | `start`, `complete`, `fail` | A wave starts; it counts as complete when the next wave starts (or on victory); fail is the wave the reactor fell on |
| `level / tutorial` | `start`, `complete` | The first-run hints appear; they finish (first wave started) |
| `hack / perfect`, `hack / good` | `used` (custom) | Every successful hack, by timing result |
| `challenge / s1-perfect` … `s4-early` | `complete` (custom) | A sector challenge is completed for the first time |
| `workshop / budget-1` … `plating-2` | `purchased` (custom) | A Workshop upgrade level is bought |

Rules kept by the code:
- One attempt sends **either** `complete` **or** `fail`, never both.
- A defeat that offers a revive is not final: `fail` is sent only when the player leaves (Retry or Menu). A revived run that then wins sends `complete`. A second defeat (no revive left) sends `fail` at once.
- Quitting mid-run from the pause menu sends nothing, so it shows as started but not finished.
- Ids never contain `/` or `^`. Wave numbers are zero-padded so they sort in order.

In dev, every call is logged to the console as `[Poki] measure …` (debug level).

## Audio and input during ads

- The `commercialBreak` and `rewardedBreak` callbacks call `sfx.suspend()`, which suspends the `AudioContext`. Audio resumes when the break promise settles.
- Keyboard shortcuts in `GameScene` are ignored while `poki.isAdPlaying` is true. The game is already paused or on the result screen whenever an ad can play.
- The tab visibility handler won't resume audio while an ad is playing.

## Rewarded ad

- **Reward:** revive with +10 reactor HP, and all enemies on the field are cleared. Once per run.
- **Button rules:** the gold "🎬 REVIVE +10 HP" button sits beside an equal-size RETRY button (the normal continue option). It is not green and has a prominent 🎬 icon, with "Watch an ad to restore the reactor" underneath, as Poki requires.
- **Result:** the reward is granted only when `rewardedBreak()` resolves `true`. Otherwise the button changes to "Ad unavailable".
- **No SDK, no reward:** Revive is offered only when the SDK initialised (`poki.rewardedAvailable`). With an ad blocker or on other hosts it's hidden, so no reward is ever given without an ad. Dev builds simulate a successful ad for testing.

## Fullscreen

Poki provides its own fullscreen control. The game's fullscreen button and the auto-fullscreen on PLAY only appear when the SDK isn't live (`poki.isLive` is false), for example on GitHub Pages.

## Submission checklist

- [ ] `npm run package` creates `release/neon-wasteland-v<version>.zip` with `index.html` at its root.
- [ ] Listing copy, categories and thumbnails are ready (see [POKI_SUBMISSION.md](POKI_SUBMISSION.md)).
- [ ] Drag `dist/` into the Poki Inspector and confirm the event order in its log.
- [ ] No ads during waves; breaks happen only at Play, Retry or Restart.
- [ ] Sound is muted during ads, and the mute setting persists.
- [ ] Touch controls work on mobile; in portrait the game auto-rotates and still fills the screen.
- [ ] No console errors in production.
- [ ] The `window.__nwd` debug hook is absent from production (it is gated by `import.meta.env.DEV`).
- [ ] Relative asset paths (`base: './'` in `vite.config.ts`).
