/** Minimal free-list pool for frequently recycled objects. */
export class ObjectPool<T> {
  private readonly free: T[] = [];

  constructor(
    private readonly factory: () => T,
    private readonly onRelease?: (item: T) => void,
  ) {}

  get(): T {
    return this.free.pop() ?? this.factory();
  }

  release(item: T): void {
    this.onRelease?.(item);
    this.free.push(item);
  }

  /** Items currently idle in the pool. */
  get size(): number {
    return this.free.length;
  }

  drain(destroy: (item: T) => void): void {
    for (const item of this.free) destroy(item);
    this.free.length = 0;
  }
}
