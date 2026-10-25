import { BATTLEGROUNDS } from '../data/battlegrounds';
import { MOBA_RULE_LIMITS, normalizeMobaRules, type MobaNumberRule, type MobaRules } from '../data/mobaRules';
import { ICON_BOWMAN, ICON_FRIENDLY_FIRE, ICON_GOLD, ICON_KEEP, ICON_RESPAWN, ICON_UPGRADES } from './icons';
import { mapThumbnail } from './mapThumbnail';
import { numberInput, optionRow } from './optionRows';

/** The online modes a host can open a room in (the menu's "Create multiplayer room"). */
export type RoomMode = 'coop' | 'moba';

const ROOM_MODES: ReadonlyArray<{ mode: RoomMode; label: string; map: keyof typeof BATTLEGROUNDS; text: string }> = [
  {
    mode: 'coop', label: 'Co-op', map: 'crimsonPass',
    text: 'Defend the keep together, two to four of you. You set up the battle (rules, levels, quiver) as alone; the others pick their own arrows.',
  },
  {
    mode: 'moba', label: 'MOBA', map: 'greenMeadow',
    text: 'Blue against red, up to three a side: minions march down the lane, gold buys upgrades by your keep (press I), the first keep to fall loses.',
  },
];

/** The host's mode picker: a big card per mode (as the battle setup's), and a MOBA match alone below. */
export const roomModeCards = (): string => `
  <div class="mode-cards">
    ${ROOM_MODES.map(({ mode, label, map, text }) => `<button type="button" class="mode-card" data-room-mode="${mode}">
      ${mapThumbnail(BATTLEGROUNDS[map])}
      <strong>${label}</strong>
      <span>${text}</span>
    </button>`).join('')}
  </div>
  <button type="button" class="secondary-button small-button room-practice" data-moba-practice>Practice MOBA alone</button>`;

/** The MOBA host's Rules tab: one rule per row (as the battle setup's Rules page). */
export const mobaRulesPage = (rules: MobaRules): string => `<div class="rules-list">
  ${optionRow('Keep health', 'Each keep starts with this; the first to fall loses the match', numberInput('data-moba-rule="keepHealth"', rules.keepHealth, MOBA_RULE_LIMITS.keepHealth), ICON_KEEP)}
  ${optionRow('Keep regeneration', 'Health each standing keep gets back every 10 seconds, up to full (0: none)', numberInput('data-moba-rule="keepRegen"', rules.keepRegen, MOBA_RULE_LIMITS.keepRegen), ICON_UPGRADES.regen)}
  ${optionRow('Bowman health', 'Each bowman before upgrades (the shop\'s Max health raises it)', numberInput('data-moba-rule="bowmanHealth"', rules.bowmanHealth, MOBA_RULE_LIMITS.bowmanHealth), ICON_BOWMAN)}
  ${optionRow('Starting gold', 'Gold in each purse when the match starts', numberInput('data-moba-rule="startGold"', rules.startGold, MOBA_RULE_LIMITS.startGold), ICON_GOLD)}
  ${optionRow('Respawn time', 'Seconds a fallen bowman waits before he is back at his keep', numberInput('data-moba-rule="respawnSeconds"', rules.respawnSeconds, MOBA_RULE_LIMITS.respawnSeconds), ICON_RESPAWN)}
  ${optionRow('Ally kill penalty', 'Killing a teammate or your own minion costs half the gold an enemy one pays', onOffChips('data-moba-toggle="allyPenalty"', rules.allyPenalty), ICON_FRIENDLY_FIRE)}
</div>`;

const onOffChips = (attribute: string, on: boolean): string => `<div class="segmented" role="radiogroup" aria-label="Ally kill penalty">
  ${[true, false].map((value) => `<button type="button" class="chip-button${value === on ? ' active' : ''}" role="radio" aria-checked="${value === on}" ${attribute} data-value="${value}">${value ? 'On' : 'Off'}</button>`).join('')}
</div>`;

/** The rules as typed in the Rules tab, clamped (an empty field keeps `current`'s value). */
export const readMobaRules = (root: HTMLElement, current: MobaRules): MobaRules => {
  const typed: Partial<MobaRules> = { ...current };
  root.querySelectorAll<HTMLInputElement>('[data-moba-rule]').forEach((input) => {
    if (input.value !== '') {
      typed[input.dataset.mobaRule as MobaNumberRule] = Number(input.value);
    }
  });
  return normalizeMobaRules(typed);
};
