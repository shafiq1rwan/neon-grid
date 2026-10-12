# KIV: Signature Mechanic "Hack the Machines"

_Status: design sketch, **not started**. Kept in view for after the v1.0.1 fit-test pass (500 plays, 4m 56s average). Build it as its own version and run a full new fit test; keep v1.0.1 as the safe build in the meantime._

## Why

Poki wants games that feel different. Today the game is a polished but conventional tower defense: fixed platforms, upgrades, a slow tower and a boss, all things players have seen before. It needs one **signature mechanic** that:

1. players see and use **within the first 10 seconds**,
2. shows up in the **thumbnail** and can be described in **one sentence**,
3. fits the story: *you are the last defense network fighting corrupted machines*.

**Pitch:** _"Hack the invasion: reprogram corrupted machines and send them back to blow up their own army."_

## Core loop change

Tower defense as usual, plus one new active action. **Tap a machine on the road to hack it.** It turns cyan, turns around and marches back down the road. When it touches the enemy horde, it self-destructs in a blast.

Every hack is a choice:
- **Kill it:** you get credits.
- **Hack it:** no credits, but you get a moving bomb at exactly the right spot.

Hacking a Juggernaut turns a big threat into a big weapon.

## Rules (v1 proposal)

### Hack charges

| Rule | Value (starting point) |
| --- | --- |
| Charges at the start of a sector | 1 |
| Maximum charges | 3 |
| Earning a charge | +1 every **12 kills** and +1 at the start of each wave (capped at 3) |
| Cost | 1 charge per hack (the Titan can't be hacked, see below) |
| Input | Tap directly on a machine. The hit radius is generous: `max(28, radius × 1.6)` px |
| No charges | The tapped machine flashes red; a "NO CHARGE" popup and an error sound play |

### What a hacked machine does

| Behaviour | Value |
| --- | --- |
| Look | Cyan tint with a brief glitch flicker, a small antenna icon, a "HACKED" popup, and a data-beam zap from the reactor to the target |
| Movement | Reverses along its own road (its distance decreases) at its normal speed. Frost slow no longer applies |
| Targeting | Towers, chain lightning, missile splash and frost ignore hacked machines |
| Contact | When it comes within `radius + 14` px of a normal machine, it **detonates** |
| Blast | Area damage in a 70 px radius, equal to **150% of the hacked machine's max HP, capped at 600 × wave `hpScale`**. The blast ignores armor and hits shields at 2x |
| Timeout | If nothing is touched within **8 s**, or it reaches the entrance, it short-circuits: a small harmless pop |
| Rewards | No kill credits. Machines killed *by the blast* pay normally |
| Reactor | Hacked machines never damage the reactor |

### Per-enemy twists (cheap, but they make hacking worth learning)

| Enemy | When hacked |
| --- | --- |
| Drone / Swarmling | Standard small bomb |
| Rift Runner | Very fast bomb; good for catching groups that are far down the road |
| Juggernaut | Big, slow bomb; the "wow" moment |
| Shielded Specter | Keeps its shield while hacked, so it survives a few hits on the way back |
| Swarm Spawner | Its swarmlings spawn **already hacked** while the hack lasts. This is the combo moment |
| **Titan (boss)** | Immune: a "FIREWALL" popup and the charge is refunded. Possible later twist: 3 charges stun it for 3 s |

## UI and feedback

- **HUD:** a hack-charge pill next to CREDITS, showing three charge pips and a thin progress bar towards the next charge. Tapping it shows the tip "Tap a machine to hack it".
- **On hack:**
  - a cyan zig-zag data beam from the reactor to the target (reusing `Effects.arc`),
  - a glitch flicker of 3–4 quick alternating tint frames,
  - a "HACKED" popup and a new `hack` sound (data chirps).
- **Hacked unit:** cyan health bar, sprite rotated 180°, a faint cyan trail.
- **Detonation:** reuses the explosion effect in cyan, plus a small screen shake.
- **Tutorial (still hints only, never blocking):** about 3 s after wave 1 starts, a hand points at the leading drone with the label **"Tap to hack!"**. It disappears after the first hack, or after 10 s.

## Thumbnail and listing

- **Thumbnail:** a cyan-hacked Juggernaut marching *against* a stream of red drones, with a big blast where they meet and a turret firing in the foreground.
- **Listing hook:** "Hack the invasion. Turn corrupted machines against their own army."
- **Short description:** "Build neon turrets, hack enemy machines and turn the invasion against itself."

## Balance

- **Blast cap:** the 600 × `hpScale` cap stops a hacked Juggernaut from wiping a whole late wave on its own.
- **Snowball risk:** hacking a Spawner early creates a lot of free hacked swarmlings. Watch this first in playtests; limit it with a shorter hack duration for Spawners if needed.
- **Sector difficulty:** hacking makes sectors easier. Expect to raise sector `difficulty` by about 5–10% after tuning (it's currently 1.1 / 1.3 / 1.7).
- **Optional, not required:** players who never hack must still be able to win, so check the "no hack" strategy with the balance bot.
- **Balance bot:** add a "hacker" strategy that hacks the highest-HP non-boss machine whenever a charge is available, and compare it with today's results (BALANCING.md).

## Implementation sketch

| Area | Change |
| --- | --- |
| `config.ts` | `HACK` constants (charges, kills per charge, duration, blast radius, multiplier, cap) |
| `entities/Enemy.ts` | `hacked`, `hackTimer` fields |
| `systems/EnemySystem.ts` | Hacked movement (reverse along the lane), contact check against normal machines, detonation, timeout. Cyan health bar. Spawners spawn hacked children while hacked. Never leak hacked units |
| `systems/TargetingSystem.ts` | `first`, `nearest` and `within` skip `e.hacked` (covers towers, Tesla chains, missile splash and Cryo) |
| `scenes/GameScene.ts` | Tap-to-hack: on pointerdown, find the nearest live, non-hacked machine within its hit radius before deselecting. Charge bookkeeping, plus a `hack` event for the UI |
| `ui/HUD.ts` | Hack-charge pill (pips plus progress bar) |
| `ui/Tutorial.ts` | Extra hint step: "Tap to hack!" on the leading machine |
| `audio/SoundSystem.ts` | `hack` and `hackBlast` sounds |
| `rendering/EffectsRenderer.ts` | Cyan blast variant (reuse `explosion`) and the data beam (reuse `arc`) |
| Docs | GAME_DESIGN (rules), BALANCING (bot strategy and results), TESTING (QA items), POKI_SUBMISSION (new hook copy) |

**Effort:** about 1–2 days of building, plus balancing with the bot, plus an 8-hour fit test.

## Secondary idea (also KIV): Overcharge

- **What:** an **OVERCHARGE** button in a tower's upgrade panel. It gives 5 s of double fire rate, then 6 s offline while the tower overheats, shown with an orange glow and smoke.
- **Why:** cheap to build, and it gives players another active choice between waves, which helps the "boring" concern.
- **When:** after Hack ships, if playtests still show idle time.

## Open questions (decide before building)

1. **Name:** Hack, Override or Hijack?
2. **Credits:** should hacked machines give 0 credits (as proposed) or half? 0 makes the choice sharper.
3. **Titan:** fully immune (as proposed), or a 3-charge stun?
4. **Input:** tap enemies directly (as proposed), or tap a HACK button and then a target? Direct is faster; a button is safer on very small phones.
5. **Unlock:** available from Sector 1, wave 1 (as proposed, so it's visible in the first 10 seconds), or introduced in Sector 2?

## Success criteria

- The fit-test average playtime stays at or above **4m 56s** (the v1.0.1 baseline), and the test passes.
- Playtest recordings show players hacking a machine within their first minute.
- No single hack wipes a whole late wave, and a no-hack player can still clear every sector.
