# Co-op online (src/net)

Two to four bowmen, host-authoritative over PeerJS (`peerjs`, its free public broker only to find each other;
`?net=local` links tabs with a BroadcastChannel instead, envelopes addressed host → one guest). Menu → "Co-op online" →
`CoopScene` (lobby, `ui/CoopPanel.ts`): host a room (5-character code, `net/roomCode.ts`) or join one. The room stays
open while the host waits, sets up or fights: up to three guests (`MAX_PLAYERS`), a fifth gets `{ t: 'full' }`.
`net/RoomHub.ts` holds the host's links by seat (player index; `net/seats.ts`, pure: lowest free seat, closing gaps)
as one `RoomLink` (`send` to all, `sendTo`, messages tagged `from`); a guest's link is `guestLink`. `net/coopLink.ts`:
`hostCoop` / `joinCoop` build `ctx.session.net` (`NetLink`: role, code, `RoomLink`, `localIndex`, `present`,
`loadouts`, wind) and take room messages out of the stream: a guest sends `{ t: 'loadout' }`, the host sends each guest
`{ t: 'roster' }` (their seat `you`, who is in, every quiver) on every join, leave or quiver change
(`setRoomListener` redraws the lobby and the setup's Quiver page; `otherQuivers`, `playerLabel`). `playerCount` =
up to the last taken seat. A guest who leaves mid-battle (`NetLink.inBattle`, `enterBattle`) leaves a gap: their
bowman stands still; back in the lobby or the setup `settleSeats` closes up the seats and renumbers the rest. A new
guest can join mid-run and fights from the next level. The host leaving sends every guest to the lobby with a notice.
The guests pick their quivers in the lobby (the same `quiverPage` and `ui/quiverEditing.ts`, saved into their own stored
setup); `loadoutOf(session, index)` is what each fights with. Esc pauses all screens: a guest asks (`{ t: 'pause' }`,
`GuestSync.requestPause`), the host decides and answers everyone (`HostSync.onPauseRequest` / `sendPause`); the pause
dialog's "Main menu" leaves the room.

- **Players**: `GameScene.players`, one `Player` per bowman (`scenes/PlayerControl.ts`: bowman, `PlayerInput`, health,
  weapon). The host is player 1, the guests 2–4 by seat (`NetLink.localIndex`; camera, aim overlay, status line follow
  the local one). Looks by index: ranger, keep warden, steppe archer, huntsman (`BOWMAN_LOOKS`); one keep tower each. Controls through `input/PlayerInput.ts`: `LocalInput`
  (keyboard and mouse), `ManualInput` (set from outside: the guests' controls on the host; `?coop` (or `?coop=3`, `?coop=4`) gives a local
  test with the others driven from the console, `scene.players[1].input.set({ direction: 1 })`),
  `RecordingInput` (guest: passes through and records presses).
- **Host** (`net/HostSync.ts`): ids for enemies and arrows, `netHooks` on Enemy/DragonEnemy (hits, swings), Arrow
  (stuck, gone, douse: a fire arrow the rain put out), Bowman (knockdown, fire) and `EffectsSystem.onEffect`; sounds, deaths, cheers and per-player status
  lines as events; every 50 ms the events since the last time (`events`, reliable) and the world (`state`, lossy, numbered,
  host time `ht`, packed by `net/snapCodec.ts`); `start` / `end` / `lobby` messages
  around levels. Each guest's `input` drives their own player (`from`; held controls by newest `n`, let go after
  400 ms of silence).
- **Links** (`net/Transport.ts`): PeerJS's reliable channel (raw strings, JSON-encoded there) plus a pre-negotiated
  lossy one (`sendState`: unordered, no retransmits, dropped while 16 KB are still queued) for `state` and held
  `input`, so a lost packet never holds up the next frame. `ping` / `pong` each second both ways; `?debug` shows ping,
  jitter, delay, loss and KB/s in a corner (`scenes/BattleNetReadout.ts`, `DomUi.setNetReadout`).
- **Guest** (`net/GuestSync.ts`): no WaveDirector, AI or CombatSystem; applies events in order with the same objects
  (same takeDamage, so the same reactions), shows snapshots in the past by host time (`net/playbackClock.ts`: 70–250 ms,
  growing with the measured jitter), interpolated (`applyNetState`,
  `applyRemote`), flies arrows locally (same ballistics, sticks into the ground itself), predicts its own bowman and
  corrects him when the host disagrees, and sends its controls every 33 ms: held ones lossy, with one-off actions
  (shots, jump, exit, burst, arrow pick) reliably (shots are loosed by the host).
- **Gameplay**: enemies go for the nearest bowman out in the open, else the keep (`systems/targeting.ts`, pure);
  `CombatWorld.bowmen`, damage events name the bowman. Health is per player (`RunState.bowmanHealths`), a fallen bowman
  stays down for the run (`Bowman.die({}, true)`), the level is lost when all have fallen or the keep falls. Player 2
  wears `secondPlayerArmor` (bronze, silver trim); each player hides in their own keep tower (`Tower.hideSpot`).
- **Feature sync seen so far** (add yours here): knight `attack` style; priest `cast` / `heal` events (troll regeneration and the shaman's cast and mend reuse them), shaman buff `EnemySnap.bf` + fx `buffPulse`, `EnemySnap.mana` / `drained`,
  fx `heal` / `healPulse`; pinned time `EnemySnap.pinned`; afflictions `af`, thrown `th`; `BowmanSnap.net`
  (`Bowman.getNetState`); horse `EnemyNet.lame`, `spawn` event `place` (`RiderOff`), `unseat` event; dragon hover side and flight look `DragonSnap.fl`;
  bowman `die` event carries the fall; exit-keep press (`PlayerInput.isExitPressed`); mid-level wind shift `wind` event; survival clock `Snapshot.clock` (fleeing enemies follow from positions).
- **MOBA**: the lobby's teams (`NetLink.teams`, roster `teams`, guest `{ t: 'team' }`, `pickTeam`; six a room); `start`
  carries `moba` / `teams`; lane minions of both sides are `spawn` events with `m` (team, level; `HostWorld.allies`),
  minion arrows `owner` -1; economy `moba` event (`MobaNet`), `gold` popups, `revive`; guest purchases `{ t: 'shop' }`.
- **Local on each side**: the survival relief force (BattleRelief, show only; the guest's comes when the host's clock runs out).
- **Not yet**: the player's soldiers (BattleAllies: the HUD slots and keys are off with `ctx.session.net`), a local preview of the guest's own arrows (they appear after a round trip), the guest's lightning bolts
  are its own (only the host's strikes hurt; their sparks arrive as effects), no reconnecting, and a hidden browser tab
  stops its game loop (keep the host's tab visible).
