# Poki Submission Kit — Neon Wasteland Defense

Everything needed to add the game on **Poki for Developers** (<https://app.poki.dev>): listing copy, category suggestions, assets, the upload build and a pre-submission checklist.

Poki doesn't publish the exact fields of its submission form; you only see them after logging in. The copy below is written to fit the usual fields (title, short and long description, controls, categories and tags). Paste the parts that match what the form asks for, and pick categories from the options it shows. SDK details are in [POKI_INTEGRATION.md](POKI_INTEGRATION.md).

---

## 1. Game info

| Field | Value |
| --- | --- |
| Title | **Neon Wasteland Defense** |
| Genre | Tower defense / strategy |
| Setting | Neon cyberpunk, post-apocalyptic city |
| Orientation | Landscape (16:9; fills wider and taller screens) |
| Platforms | Desktop, mobile, tablet |
| Input | Mouse, touch, keyboard shortcuts |
| Session length | About 6–8 minutes per sector; about 20 minutes for the 3-sector campaign (32 waves) |
| Engine | Phaser 3.90 (HTML5 / WebGL), TypeScript |
| Build size | About 380 KB zipped, 1.5 MB unzipped. No external assets or fonts. |
| Save data | LocalStorage (settings, tutorial completion, best rating, wins) |
| Monetisation | Poki SDK only: commercial breaks between runs plus an optional rewarded revive |
| In-app purchases / external links / analytics | None |
| Languages | English |

## 2. Listing copy

### Title
Neon Wasteland Defense

### Short description (one line)
> Build neon turrets and stop waves of rogue machines before they reach the last reactor.

### Medium description (2–3 sentences)
> The machines have taken the ruined city, and only your automated defense grid stands between them and the last energy reactor. Build five kinds of neon turrets, upgrade them into powerful war machines, and hold three city sectors against increasingly brutal waves, ending with a colossal Titan. Can you earn all nine stars?

### Long description
> **Neon Wasteland Defense** is a fast, stylish tower defense game set in a ruined cyberpunk city.
>
> Corrupted drones, armored juggernauts, shielded specters, swarm-spawning carriers and a colossal Titan march toward your energy reactor across three sectors of the ruined city. Tap the abandoned defense platforms to build turrets, earn credits for every machine you destroy, and spend them on upgrades that visibly transform each tower.
>
> **Six unique turrets**, a new one unlocked in each sector
> - **Pulse Tower:** rapid-fire energy bolts, great against fast enemies.
> - **Cannon Tower:** heavy shells that smash through armor.
> - **Missile Tower:** homing missiles with explosive splash damage.
> - **Tesla Tower:** chain lightning that jumps between enemies and melts shields.
> - **Laser Tower:** a continuous beam that charges up and burns through anything.
> - **Cryo Tower:** frost pulses that slow every machine in range and leave them brittle.
>
> **Features**
> - A 3-sector campaign with 32 handcrafted waves: a winding road, twin attack lanes, and a long highway ending in a boss fight
> - New enemy types introduced along the way, including the Titan boss
> - 3 upgrade levels per tower, each with new armor, weapons and effects
> - Call waves early for bonus credits
> - 1x / 2x game speed
> - Earn up to 3 stars per sector by keeping your reactor healthy
> - Quick, skippable tutorial; play in short sessions on desktop or mobile

### How to play / controls

**Mobile and tablet**
- Tap a glowing platform, then tap a tower to build it.
- Tap a tower to upgrade or sell it.
- Tap the red beacon by the road entrance to start the next wave early.

**Desktop**
- Click a platform, then pick a tower. Click a tower to upgrade or sell it.
- `Space`: next wave · `1`–`5`: quick build · `U`: upgrade · `S`: sell · `F`: game speed · `P` / `Esc`: pause

**Goal:** stop the machines before they reach the reactor. Survive every wave to clear a sector and unlock the next.

## 3. Categories and tags (suggested)

Choose from the options the form offers. These are the closest fits:

| Priority | Suggestion |
| --- | --- |
| Primary category | **Tower Defense** |
| Secondary category | **Strategy** |
| Also relevant | Defense, Sci-Fi / Futuristic, Robots / Machines, Upgrade, Casual Strategy, Mobile |
| Search keywords | tower defense, td, turret, neon, cyberpunk, robots, machines, strategy, upgrade, defense, sci-fi, wasteland |

**Audience and content notes** (for any rating or content questions):
- **Violence:** mild, non-graphic sci-fi combat against machines only. No blood and no humans.
- **Online features:** no chat, user-generated content or multiplayer.
- **Commerce and data:** no purchases and no personal data collection.

## 4. Thumbnails

### Static thumbnail (required for the player fit test) ✅
- **File:** `output/marketing/poki-thumbnail.png`, 1254 × 1254, full-bleed, no text.
- **Poki's rule:** a square at least 628 × 628, with no borders, padding or letterboxing. The file already meets this.
- **Content:** the Pulse turret firing at a Juggernaut, a Tesla tower arcing drones, and the reactor. No text, no Poki logo. The colors stay away from Poki's background `#83FFE7`.
- **Watch-out:** the thumbnail is more detailed and painterly than the in-game vector art. Poki asks that thumbnails match the game. If test results suggest a mismatch, regenerate it closer to the in-game look.

### Animated thumbnail (needed during Soft Release, before global release) ⏳
Poki's spec: **1080 × 1080 or larger, 1:1, at least 50 fps, 4–6 s, muted, .mp4, at most 100 MB**. It should focus on gameplay with minimal text: 2–3 scenes of about 1–2 s each, starting from the static artwork, with simplified UI and no cursor.

Suggested shot list (record in-game at 2x speed with the HUD hidden):
1. **0.0–1.5 s:** a hold on the static thumbnail art, then a cut to the game.
2. **1.5–3.5 s:** a wave of drones and a Juggernaut on the road while Tesla arcs chain and missiles explode.
3. **3.5–5.5 s:** a tower upgrade pop (Lv2 → Lv3) and the laser beam melting a shielded Specter.

## 5. Build upload

```bash
npm install
npm run package
```

This type-checks, builds and writes **`release/neon-wasteland-defense-v<version>.zip`**. `index.html` is at the root of the zip:

```
index.html
assets/index-<hash>.js
assets/phaser-<hash>.js
```

- Upload that zip (or the `dist/` folder) as the web build.
- `release/` is git-ignored, so rebuild it after any change.
- Bump `version` in `package.json` for each new upload.

**Before uploading, test in the Poki Inspector:** drag the `dist/` folder (or the unzipped build) into the Inspector and check its event log for `gameLoadingFinished`, `gameplayStart`/`gameplayStop` on pause and resume, and commercial and rewarded breaks.

## 6. Requirements checklist

Mapped to Poki's [requirements & quality guidelines](https://developers.poki.com/guide/requirements-quality):

| Requirement | Status |
| --- | --- |
| Covers the full canvas at 16:9; works on desktop, mobile and tablet | ✅ Scale EXPAND: 16:9 frames show exactly the battlefield, and other shapes fill the screen |
| Mobile covers the full screen (landscape) | ✅ Portrait shows a rotate prompt |
| Fast loading, small initial download | ✅ About 380 KB zipped. Art and sound are generated in code. |
| No external requests (fonts, assets, libraries bundled) | ✅ Only the Poki SDK script is loaded |
| localStorage wrapped in try/catch (incognito) | ✅ `utils/Storage.ts` |
| Progress saved | ✅ Settings and best results. A run lasts about 6 minutes and isn't resumable. |
| Audio muted during ads | ✅ `AudioContext` suspended in the break callbacks |
| SDK events correct, no duplicates; `gameplayStart` after player input | ✅ Starts after the PLAY tap; the adapter drops duplicate events |
| `commercialBreak` only at natural breaks; no internal ad timers | ✅ Before Play, Retry and Restart only |
| Playable with an ad blocker; no reward when ads are blocked | ✅ Revive is hidden when the SDK isn't ready |
| Rewarded button: not green, prominent 🎬, normal continue button beside or above at equal or larger size | ✅ Gold "🎬 REVIVE +10 HP" beside an equal-size green RETRY |
| One reward per video; no double reward | ✅ Revive works once per run, with a busy-guard |
| Poki SDK is the only ad system; no IAP or ad-removal UI | ✅ |
| No splash screens or outgoing links | ✅ |
| Pause via Esc (or Space) on keyboard, with SDK events | ✅ `P`/`Esc` pause and resume (Space is "next wave") |
| Skippable tutorial; visual, not text-heavy | ✅ Skippable. Uses highlights and arrows plus short one- or two-line hints. |
| Mobile controls on touch, keyboard hints on desktop | ✅ Tap-only UI; keyboard shortcuts listed in the menu |
| Clean build (no debug tools) | ✅ The `window.__nwd` hook only exists in dev builds |
| Fullscreen | ✅ The game's own fullscreen button is hidden on Poki, which handles fullscreen itself |
| Static thumbnail | ✅ `output/marketing/poki-thumbnail.png` |
| Animated thumbnail | ⏳ Needed during Soft Release (see section 4) |

## 7. Release stages

After you add the game, Poki moves it through five stages: **Add your game → Get player feedback → Player Fit Test → Poki Web Fit Test → Final Poki Review**. The static thumbnail is needed to start the player fit test, and the animated one before global release.

## Sources

- [Poki HTML5 SDK guide](https://developers.poki.com/guide/sdk-html5)
- [Requirements & quality guidelines](https://developers.poki.com/guide/requirements-quality)
- [Game thumbnail guide](https://developers.poki.com/guide/game-thumbnail)
- [Your game page (animated thumbnail specs)](https://developers.poki.com/guide/your-game-page)
- [Adding your game](https://developers.poki.com/guide/adding-your-game)
