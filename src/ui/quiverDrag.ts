import { isArrowType, type ArrowType } from '../data/loadout';

/** What is dragged on the Quiver page: an arrow card, or the arrow in a slot. */
export type QuiverDragSource = { arrow: ArrowType } | { slot: number };
/** Where it's dropped: a slot, or back onto the arrow list (empties a dragged slot). */
export type QuiverDropTarget = { slot: number } | 'arrows';

/** The pointer has to move this far (px) before a press becomes a drag; less is a click. */
const DRAG_THRESHOLD = 6;

/**
 * Drag and drop on the Quiver page, with pointer events (mouse and touch): an arrow card or a filled slot
 * picks up its arrow icon, a slot under the pointer lights up (`drop-target`) and `onDrop` gets the move.
 * A press that doesn't move stays a click (the click after a drag is swallowed).
 */
export class QuiverDrag {
  private press?: { source: QuiverDragSource; art: Element; x: number; y: number; pointerId: number };
  private ghost?: HTMLElement;
  private target?: HTMLElement;
  private swallowClick = false;

  public constructor(private readonly root: HTMLElement, private readonly onDrop: (source: QuiverDragSource, target: QuiverDropTarget) => void) {
    root.addEventListener('pointerdown', (event) => this.down(event));
    window.addEventListener('pointermove', (event) => this.move(event));
    window.addEventListener('pointerup', (event) => this.up(event));
    window.addEventListener('pointercancel', () => this.reset());
    root.addEventListener('click', (event) => {
      if (this.swallowClick) {
        this.swallowClick = false;
        event.stopPropagation();
      }
    }, true);
  }

  private down(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    const element = event.target as HTMLElement;
    if (element.closest('[data-slot-clear]')) {
      return;
    }
    const card = element.closest<HTMLElement>('[data-arrow]');
    const slot = element.closest<HTMLElement>('[data-slot]:not(.empty)');
    const source: QuiverDragSource | undefined = card && isArrowType(card.dataset.arrow)
      ? { arrow: card.dataset.arrow }
      : slot ? { slot: Number(slot.dataset.slot) } : undefined;
    const art = (card ?? slot)?.querySelector('.weapon-art');
    if (source && art) {
      this.press = { source, art, x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    }
  }

  private move(event: PointerEvent): void {
    const press = this.press;
    if (!press || event.pointerId !== press.pointerId) {
      return;
    }
    if (!this.ghost) {
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < DRAG_THRESHOLD) {
        return;
      }
      this.ghost = this.makeGhost(press.art);
      this.root.classList.add('quiver-dragging');
    }
    event.preventDefault();
    this.ghost.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -50%)`;
    const over = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot]') ?? undefined;
    const target = over && this.root.contains(over) ? over : undefined;
    if (target !== this.target) {
      this.target?.classList.remove('drop-target');
      target?.classList.add('drop-target');
      this.target = target;
    }
  }

  private up(event: PointerEvent): void {
    const press = this.press;
    if (!press || event.pointerId !== press.pointerId) {
      return;
    }
    if (this.ghost) {
      this.swallowClick = true;
      // The click (if any) follows right away; don't let a stale flag eat the next real one.
      setTimeout(() => { this.swallowClick = false; }, 0);
      const overList = document.elementFromPoint(event.clientX, event.clientY)?.closest('.arrow-cards');
      const target: QuiverDropTarget | undefined = this.target
        ? { slot: Number(this.target.dataset.slot) }
        : overList && this.root.contains(overList) ? 'arrows' : undefined;
      this.reset();
      if (target) {
        this.onDrop(press.source, target);
      }
      return;
    }
    this.reset();
  }

  /** A copy of the dragged arrow's icon at the size it's shown (the panel may be zoomed), under the pointer. */
  private makeGhost(art: Element): HTMLElement {
    const rect = art.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'quiver-ghost';
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.append(art.cloneNode(true));
    document.body.append(ghost);
    return ghost;
  }

  private reset(): void {
    this.press = undefined;
    this.ghost?.remove();
    this.ghost = undefined;
    this.target?.classList.remove('drop-target');
    this.target = undefined;
    this.root.classList.remove('quiver-dragging');
  }
}
