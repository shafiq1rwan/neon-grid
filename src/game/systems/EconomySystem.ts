export class EconomySystem {
  private value: number;
  /** Total credits earned this run (for the results screen). */
  earned = 0;

  constructor(start: number) {
    this.value = start;
  }

  get credits(): number {
    return this.value;
  }

  canAfford(cost: number): boolean {
    return this.value >= cost;
  }

  spend(cost: number): boolean {
    if (cost > this.value) return false;
    this.value -= cost;
    return true;
  }

  earn(amount: number): void {
    if (amount <= 0) return;
    this.value += amount;
    this.earned += amount;
  }
}
