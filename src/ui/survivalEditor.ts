import { ENEMY_GROUPS, ENEMY_GROUP_IDS, enemyTypesOf } from '../data/enemyKinds';
import { ENEMY_TYPE_LABELS, SURVIVAL_MINUTES, type SurvivalLevel } from '../data/sandbox';
import type { EnemyType } from '../types';
import { ICON_ENEMIES } from './icons';

/**
 * The survival level editor's markup (SandboxForm handles the clicks): the time to hold out (− N min +) and which
 * kinds come, a toggle card per kind (how many is up to systems/survivalWaves.ts).
 */

/** The level tab's second line. */
export const survivalTabText = (level: SurvivalLevel): string =>
  `${level.minutes} min · ${level.kinds.length} ${level.kinds.length === 1 ? 'kind' : 'kinds'}`;

const kindCard = (type: EnemyType, on: boolean, last: boolean): string =>
  `<button type="button" class="enemy-card kind-toggle${on ? '' : ' empty'}" data-survival-kind="${type}" aria-pressed="${on}"${last ? ' disabled title="At least one kind must come"' : ''}>
    ${ICON_ENEMIES[type]}
    <span class="enemy-name">${ENEMY_TYPE_LABELS[type]}</span>
    <span class="kind-state">${on ? 'Comes' : 'Off'}</span>
  </button>`;

export const survivalEditor = (level: SurvivalLevel): string => `
  <div class="sandbox-section-label">Hold out</div>
  <div class="survival-time">
    <span class="stepper">
      <button type="button" data-minutes="-1" aria-label="A minute less"${level.minutes <= SURVIVAL_MINUTES.min ? ' disabled' : ''}>−</button>
      <output>${level.minutes} min</output>
      <button type="button" data-minutes="1" aria-label="A minute more"${level.minutes >= SURVIVAL_MINUTES.max ? ' disabled' : ''}>+</button>
    </span>
    <small>until dawn; the enemy comes in ever bigger waves and flees at sunrise</small>
  </div>
  <div class="sandbox-section-label">Enemies <span>${level.kinds.length}</span></div>
  ${ENEMY_GROUP_IDS.map((group) => `<div class="enemy-group-label">${ENEMY_GROUPS[group].label}</div>
  <div class="enemy-cards">
    ${enemyTypesOf(group).map((type) => kindCard(type, level.kinds.includes(type), level.kinds.length === 1 && level.kinds[0] === type)).join('')}
  </div>`).join('')}`;
