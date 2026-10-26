import { BANDAGE_KNEEL_MS } from '../../rendering/bandaging';

/** The medic (an ally, `enemy.bandage`): bandaging now (she kneels), and how far down she is (0 standing … 1 kneeling). */
export class MedicKneel {
  private bandaging = false;
  private kneel = 0;

  public constructor(private readonly alive: () => boolean) {}

  /** Kneels to bandage (AllyAI, which halts her); a hit on her or `stop` gets her up. */
  public start(): void {
    this.bandaging = true;
  }

  public stop(): void {
    this.bandaging = false;
  }

  public get isBandaging(): boolean {
    return this.bandaging && this.alive();
  }

  /** Down or getting up: she can't walk until she is on her feet. */
  public get isKneeling(): boolean {
    return this.kneel > 0;
  }

  /** The kneel moves towards down while bandaging, up otherwise (EnemyFigure draws it). */
  public advance(deltaMs: number): number {
    this.kneel = Math.max(0, Math.min(1, this.kneel + (this.isBandaging ? 1 : -1) * deltaMs / BANDAGE_KNEEL_MS));
    return this.kneel;
  }
}
