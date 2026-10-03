/** Limit active work and allow queued requests to cancel before starting. */
export class ConcurrencyGate {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  private readonly limit: number;

  constructor(limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new Error("Concurrency limit must be a positive safe integer.");
    }
    this.limit = limit;
  }

  /** Run work when a slot is available, rejecting canceled queued work. */
  async run<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
    if (signal.aborted) throw signal.reason;
    const shouldQueue = this.active >= this.limit;
    if (shouldQueue) {
      await new Promise<void>((resolve, reject) => {
        const ready = () => {
          signal.removeEventListener("abort", canceled);
          resolve();
        };
        const canceled = () => {
          const index = this.queue.indexOf(ready);
          if (index >= 0) this.queue.splice(index, 1);
          // Preserve AbortSignal's caller-supplied cancellation reason.
          /* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
          reject(signal.reason);
          /* eslint-enable @typescript-eslint/prefer-promise-reject-errors */
        };
        this.queue.push(ready);
        signal.addEventListener("abort", canceled, { once: true });
      });
    }
    if (!shouldQueue) this.active += 1;
    try {
      if (signal.aborted) throw signal.reason;
      return await work();
    } finally {
      const next = this.queue.shift();
      if (next) next();
      else this.active -= 1;
    }
  }
}
