# Co-op online (src/net)

Two bowmen, host-authoritative over PeerJS (`peerjs`, its free public broker only to find each other; `?net=local`
links two tabs with a BroadcastChannel instead). Menu → "Co-op online" → `CoopScene` (lobby, `ui/CoopPanel.ts`): host a
room (5-character code, `net/roomCode.ts`) or join one. The host sets up the battle (SandboxScene, back = lobby) and
starts it; the guest waits in the lobby, meanwhile picking their own quiver there (`CoopPanel`, the same `quiverPage` and
`ui/quiverEditing.ts` as the setup's Quiver page; starts from and is saved into the guest's own stored setup). Each sends
their quiver (`{ t: 'loadout' }`, on linking up and on every change; `net/coopLink.ts` takes these messages out of the
transport so they arrive in any scene) and sees the other's (`partnerQuiver`: the host in the lobby and on the Quiver
page, the guest under their own); `NetLink.loadouts` holds both by player and `loadoutOf(session, index)` is what each
fights with (HUD slots, keys, the host checks the guest's picks). `ctx.session.net` (`NetLink`: role, code,
`Transport`, the level's wind, both quivers) and `playerCount` 2; `net/coopLink.ts` links up and handles a dropped link
(guest back to the lobby with a notice; host plays on, player 2 stands still); Esc in a co-op battle leaves the room.

- **Players**: `GameScene.players`, one `Player` per bowman (`scenes/PlayerControl.ts`: bowman, `PlayerInput`, health,
  weapon). The host is player 1, the guest player 2 (`localIndex`; camera, aim overlay, status line follow the local
  one; the HUD shows player 1 then player 2 on both screens). Controls through `input/PlayerInput.ts`: `LocalInput`
  (keyboard and mouse), `ManualInput` (set from outside: the guest's controls on the host; `?coop` alone gives a local
  2-bowman test with player 2 driven from the console, `scene.players[1].input.set({ direction: 1 })`),
  `RecordingInput` (guest: passes through and records presses).
- **Host** (`net/HostSync.ts`): ids for enemies and arrows, `netHooks` on Enemy/DragonEnemy (hits, swings), Arrow
  (stuck, gone), Bowman (knockdown, fire) and `EffectsSystem.onEffect`; sounds, deaths, cheers and per-player status
  lines as events; a `frame` (snapshot + events, `net/protocol.ts`) every 50 ms; `start` / `end` / `lobby` messages
  around levels. The guest's `input` drives player 2.
- **Guest** (`net/GuestSync.ts`): no WaveDirector, AI or CombatSystem; applies events in order with the same objects
  (same takeDamage, so the same reactions), shows snapshots 100 ms in the past, interpolated (`applyNetState`,
  `applyRemote`), flies arrows locally (same ballistics, sticks into the ground itself), predicts its own bowman and
  corrects him when the host disagrees, and sends its controls every 33 ms (shots are loosed by the host).
- **Gameplay**: enemies go for the nearest bowman out in the open, else the keep (`systems/targeting.ts`, pure);
  `CombatWorld.bowmen`, damage events name the bowman. Health is per player (`RunState.bowmanHealths`), a fallen bowman
  stays down for the run (`Bowman.die({}, true)`), the level is lost when all have fallen or the keep falls. Player 2
  wears `secondPlayerArmor` (bronze, silver trim) and hides in the keep's lower second tower.
- **Feature sync seen so far** (add yours here): knight `attack` style; priest `cast` / `heal` events, `EnemySnap.mana` / `drained`,
  fx `heal` / `healPulse`; pinned time `EnemySnap.pinned`; afflictions `af`, thrown `th`; `BowmanSnap.net`
  (`Bowman.getNetState`); horse `EnemyNet.lame`, `spawn` event `place` (`RiderOff`), `unseat` event; dragon hover side;
  bowman `die` event carries the fall; exit-keep press (`PlayerInput.isExitPressed`).
- **Not yet**: a local preview of the guest's own arrows (they appear after a round trip), the guest's lightning bolts
  are its own (only the host's strikes hurt; their sparks arrive as effects), no reconnecting, and a hidden browser tab
  stops its game loop (keep the host's tab visible).
