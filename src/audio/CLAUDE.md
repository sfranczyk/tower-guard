# Audio (src/audio)

- **Effects**: `ctx.sound` (`SoundManager.ts`) plays `assets/sounds/` (the user's own recordings from `human/`, trimmed
  and normalized with ffmpeg). `CombatSystem` emits `sound(id, at)`; `GameScene` plays them through `spatialMix` (pan
  by screen position, quieter off screen). An arrow sinking into a body plays `arrowFlesh` (`Pghrt.m4a`; not into ice,
  not explosive). Enemies groan on every arrow hit (8 variants), except an explosive kill (just the blast); falls are
  silent. Thunder is the old "Bum" recording (`thunder.mp3`) slowed down (`SOUND_RATES`); `explosion.mp3` is
  synthesized with ffmpeg (thump, brown-noise blast, crackle, rumble).
- **New sound**: add the mp3, its id in `SOURCES` (an array of variants), its volume in `config.ts` (`SOUND_VOLUMES`)
  and its description in `soundCatalog.ts` (shown in the sound test panel). When trimming, don't denoise quiet takes or
  fade out trailing fricatives, or they get eaten.
- **Music** (`MusicPlayer.ts`): `assets/sounds/theme.mp3` (from the user's Suno track `human/resonant-drone.mp3`),
  started once at boot, plays across scenes: intro once, then loops `MUSIC_LOOP_START_S..MUSIC_LOOP_END_S`; the last
  6 s before the loop end are crossfaded in the file into the audio before the loop start. Re-cut the file → keep the
  loop points in `config.ts` in sync. Music and effects have separate toggles and volumes (`audioSettings.ts`,
  persisted).
