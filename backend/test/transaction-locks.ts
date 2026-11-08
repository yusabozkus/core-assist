// Simulate transaction-scoped DB locks, without serializing whole transactions.
// Unrelated transactions overlap; only explicitly acquired keys share a queue.
export class TransactionLocks {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(action: (lock: (key: string) => Promise<void>) => Promise<T>) {
    const held = new Set<string>();
    const releases: Array<() => void> = [];
    try {
      return await action(async (key) => {
        if (held.has(key)) return;
        const previous = this.tails.get(key) ?? Promise.resolve();
        let release!: () => void;
        const owned = new Promise<void>((resolve) => {
          release = resolve;
        });
        const tail = previous.then(() => owned);
        this.tails.set(key, tail);
        await previous;
        held.add(key);
        releases.push(() => {
          release();
          if (this.tails.get(key) === tail) this.tails.delete(key);
        });
      });
    } finally {
      for (const release of releases.reverse()) release();
    }
  }
}
