/**
 * Banners (scenes/BattleBanners.ts): what a soldier does with one. Carried in both hands ('held', drawn with
 * withBanner), or stuck in the ground at `plantX` while he fights ('planted'; the AIs' walkOnGuard), or none.
 */
export class BannerHold {
  public state: 'none' | 'held' | 'planted' = 'none';
  public plantX = 0;
  /** His pace while carrying it (BANNERS.riderSpeedFactor on horseback, else 1). */
  public carrySpeed = 1;

  /** Sets the banner in the ground beside him (`at`), on his side away from `foeX`, to fight. */
  public plant(at: { x: number; size: number }, foeX: number): void {
    if (this.state === 'held') {
      this.state = 'planted';
      this.plantX = at.x - Math.sign(foeX - at.x || 1) * 10 * at.size;
    }
  }

  /** Picks it up again after the fight. */
  public lift(): void {
    if (this.state === 'planted') {
      this.state = 'held';
    }
  }
}
