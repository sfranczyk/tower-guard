---
name: new-animation
description: Checklist for adding or changing a stickman, dragon or horse animation in Tower Guard (pure pose math, tests, lab row, look coverage). Use whenever a pose, move, fall, cheer or attack animation is added or tuned.
---

# Adding an animation

1. **Pose math** in `src/rendering/` as a pure function of progress 0..1 (one-shot) or time (loop), next to its kind:
   walks `walkCycle.ts`, attacks `attackSwing.ts` (progress 0 and 1 = standing pose; `attackImpactProgress`), falls
   `stickmanFall.ts`, cheers `stickmanCheer.ts`, dragons `dragon*.ts`, horse `horseRider.ts` / `horseDeath.ts`.
   Use the existing IK and `groundedAngle` helpers so feet stay planted.
2. **Test** next to it: limb lengths kept, nothing below the ground, loops continuous, elbows/knees not bent backwards.
3. **Lab row** in `src/scenes/labRows.ts` (`LAB_CATEGORIES`; looping falls/gibs in `labSequences.ts`). Its id gives
   `?lab=<id>`.
4. **Looks**: if enemies or the player use it, `src/rendering/designs/bodyPoses.ts` must produce the BodyPose for it
   (pure, tested) so every look draws it; check one look in `?designs=<id>`.
5. **Game hook-up**: the state that plays it (`objects/Enemy.ts` body state, `objects/Bowman.ts`), and co-op if the host
   triggers it (`src/net/CLAUDE.md`).
6. **Verify**: `npm run verify`, then open `?lab=<id>` in a background tab, one screenshot at scale 0.5. For timing
   tweaks give the user the numbers in `config.ts` / the tuning panel instead of iterating on screenshots.
7. 1–3 lines in `src/rendering/CLAUDE.md`; commit.
