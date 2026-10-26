import type { Loadout } from '../data/loadout';
import type { LevelReport } from '../systems/battleStats';
import { endReportHtml, type ReportTab } from './endReport';
import type { UiHandlers } from './uiHandlers';
import { onClickIn, queryIn } from './domQuery';
import { compactQuiver } from './quiverPage';
import { editQuiverIn, type QuiverEdit } from './quiverEditing';

/** What the battle's pause dialog shows. */
export interface PauseView {
  byPartner: boolean;
  coop: boolean;
  /** Alone or the co-op host: "Restart level" (the guest waits for the host). */
  canRestart: boolean;
  /** The local bowman is in the keep: his quiver, editable in the dialog. */
  quiver?: Loadout;
  /** MOBA: the battle goes on behind the dialog (nothing is paused), and there is no quiver to edit. */
  running?: boolean;
}

export interface EndScreenOptions {
  title: string;
  /** Colours the title: green for a win, red for a loss. */
  outcome: 'win' | 'loss';
  copy: string;
  /** Small figures shown in a row under the copy (e.g. enemies defeated, keep health). */
  stats?: ReadonlyArray<{ label: string; value: string }>;
  /** The level's count (systems/battleStats.ts): the card widens to show it. */
  report?: LevelReport;
  buttonLabel: string;
  onButton: () => void;
}

/** The battle's cards over the canvas: the end screen (with "View battlefield") and the pause dialog. */
export class BattleDialogs {
  private readonly endScreen: HTMLElement;
  private readonly endTitle: HTMLElement;
  private readonly endCopy: HTMLElement;
  private readonly endStats: HTMLElement;
  private readonly endReport: HTMLElement;
  private readonly endCard: HTMLElement;
  /** The report shown on the end card, and its open tab. */
  private report?: LevelReport;
  private reportTab: ReportTab = 'overview';
  private readonly endButton: HTMLButtonElement;
  private onEndButton?: () => void;
  private readonly pauseScreen: HTMLElement;
  private readonly pauseTitle: HTMLElement;
  private readonly pauseCopy: HTMLElement;
  private readonly pauseCard: HTMLElement;
  private readonly pauseQuiverRoot: HTMLElement;
  private readonly pauseRestart: HTMLElement;
  /** The quiver being edited in the pause dialog (undefined while none is shown). */
  private pauseQuiver?: QuiverEdit;
  /** MOBA: no quiver to edit (every arrow bought is in it). */
  private pauseRunning = false;

  public constructor(root: ParentNode, private readonly handlers: UiHandlers) {
    this.endScreen = queryIn(root, '[data-end]');
    this.endTitle = queryIn(root, '[data-end-title]');
    this.endCopy = queryIn(root, '[data-end-copy]');
    this.endStats = queryIn(root, '[data-end-stats]');
    this.endReport = queryIn(root, '[data-end-report]');
    this.endCard = queryIn(root, '[data-end] .end-card');
    this.endButton = queryIn<HTMLButtonElement>(root, '[data-end-button]');
    this.pauseScreen = queryIn(root, '[data-pause]');
    this.pauseTitle = queryIn(root, '[data-pause-title]');
    this.pauseCopy = queryIn(root, '[data-pause-copy]');
    this.pauseCard = queryIn(root, '[data-pause] .end-card');
    this.pauseQuiverRoot = queryIn(root, '[data-pause-quiver]');
    this.pauseRestart = queryIn(root, '[data-pause-restart]');
    editQuiverIn(this.pauseQuiverRoot, () => this.pauseQuiver, ({ loadout, slot, changed }) => {
      this.pauseQuiver = { loadout, slot };
      this.renderPauseQuiver();
      if (changed) {
        handlers.pauseLoadout?.(loadout);
      }
    });
    this.endButton.addEventListener('click', () => this.onEndButton?.());
    this.endReport.addEventListener('click', (event) => {
      const tab = (event.target as HTMLElement).closest<HTMLElement>('[data-report-tab]')?.dataset.reportTab;
      if (tab && this.report) {
        this.reportTab = tab as ReportTab;
        this.endReport.innerHTML = endReportHtml(this.report, this.reportTab);
      }
    });
    onClickIn(root, '[data-end-view]', () => this.setEndViewing(true));
    onClickIn(root, '[data-end-back]', () => this.setEndViewing(false));
    onClickIn(root, '[data-pause-resume]', () => handlers.pauseResume?.());
    onClickIn(root, '[data-pause-restart]', () => handlers.pauseRestart?.());
    onClickIn(root, '[data-pause-settings]', () => handlers.toggleOptions?.());
    onClickIn(root, '[data-pause-menu]', () => handlers.pauseMenu?.());
  }

  /** Hides both (a new screen is shown). */
  public hide(): void {
    this.endScreen.hidden = true;
    this.endScreen.classList.remove('viewing');
    this.pauseScreen.hidden = true;
  }

  public showEndScreen(options: EndScreenOptions): void {
    this.endTitle.textContent = options.title;
    this.endTitle.dataset.outcome = options.outcome;
    this.endCopy.textContent = options.copy;
    this.endStats.innerHTML = (options.stats ?? [])
      .map(({ label, value }) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
    this.endStats.hidden = !options.stats?.length;
    this.report = options.report;
    this.reportTab = 'overview';
    this.endReport.innerHTML = options.report ? endReportHtml(options.report) : '';
    this.endReport.hidden = !options.report;
    this.endCard.classList.toggle('end-wide', options.report !== undefined);
    this.endButton.textContent = options.buttonLabel;
    this.onEndButton = options.onButton;
    this.endScreen.hidden = false;
    this.endScreen.classList.remove('viewing');
  }

  /**
   * Hides the end card to look over the battlefield (only a "Back to results" button stays), or brings it back; tells
   * the scene (`handlers.viewBattlefield`).
   */
  public setEndViewing(viewing: boolean): void {
    if (this.endScreen.hidden || this.endScreen.classList.contains('viewing') === viewing) {
      return;
    }
    this.endScreen.classList.toggle('viewing', viewing);
    this.handlers.viewBattlefield?.(viewing);
  }

  /**
   * The battle's pause dialog (hidden with `undefined`). It lies under the settings window and the tuning panel, so
   * both stay usable while paused.
   */
  public showPause(pause: PauseView | undefined): void {
    this.pauseScreen.hidden = !pause;
    if (pause) {
      this.pauseRunning = pause.running === true;
      this.pauseTitle.textContent = pause.running ? 'Menu' : 'Paused';
      this.pauseCopy.textContent = pause.running ? 'The battle goes on while this is open.' : pause.byPartner ? 'Another player paused the battle.' : pause.coop ? 'Paused for all players.' : 'The battle waits for you.';
      this.pauseRestart.hidden = !pause.canRestart;
      this.pauseQuiver = pause.quiver ? { loadout: [...pause.quiver], slot: 0 } : undefined;
      this.renderPauseQuiver();
    }
  }

  /** In the keep: the quiver editor; out in the open: a hint where to change it. */
  private renderPauseQuiver(): void {
    this.pauseCard.classList.toggle('pause-wide', this.pauseQuiver !== undefined);
    this.pauseQuiverRoot.innerHTML = this.pauseQuiver
      ? compactQuiver(this.pauseQuiver.loadout, this.pauseQuiver.slot)
      : this.pauseRunning ? '' : '<p class="pause-quiver-hint">Hide in the keep to change your quiver.</p>';
  }
}
