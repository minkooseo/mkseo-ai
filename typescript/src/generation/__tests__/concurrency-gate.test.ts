import { describe, expect, it } from "vitest";
import { ConcurrencyGate } from "../concurrency-gate.ts";

describe("ConcurrencyGate", () => {
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid concurrency limit %s",
    (limit) => {
      expect(() => new ConcurrencyGate(limit)).toThrow(
        "Concurrency limit must be a positive safe integer.",
      );
    },
  );

  it("starts queued work in order as active work completes", async () => {
    const gate = new ConcurrencyGate(2);
    const signal = new AbortController().signal;
    const first = barrier();
    const second = barrier();
    const started: number[] = [];
    const one = gate.run(signal, async () => {
      started.push(1);
      await first.promise;
      return "first";
    });
    const two = gate.run(signal, async () => {
      started.push(2);
      await second.promise;
      return "second";
    });
    const three = gate.run(signal, () => {
      started.push(3);
      return Promise.resolve("third");
    });
    const four = gate.run(signal, () => {
      started.push(4);
      return Promise.resolve("fourth");
    });
    expect(started).toEqual([1, 2]);
    second.release();
    expect(await Promise.all([two, three, four])).toEqual([
      "second",
      "third",
      "fourth",
    ]);
    expect(started).toEqual([1, 2, 3, 4]);
    first.release();
    expect(await one).toBe("first");
  });

  it("removes canceled queued work without consuming a slot", async () => {
    const gate = new ConcurrencyGate(1);
    const signal = new AbortController().signal;
    const active = barrier();
    const one = gate.run(signal, () => active.promise);
    const controller = new AbortController();
    const canceled = gate.run(controller.signal, () => {
      throw new Error("Canceled work must not start.");
    });
    const failed = expect(canceled).rejects.toThrow("No longer needed.");
    const next = gate.run(signal, () => Promise.resolve("next"));
    controller.abort(new Error("No longer needed."));
    await failed;
    active.release();
    await one;
    expect(await next).toBe("next");
  });

  it("releases the slot after work fails", async () => {
    const gate = new ConcurrencyGate(1);
    const signal = new AbortController().signal;
    const active = barrier();
    const failed = gate.run(signal, async () => {
      await active.promise;
      throw new Error("Work failed.");
    });
    const rejection = expect(failed).rejects.toThrow("Work failed.");
    const next = gate.run(signal, () => Promise.resolve("next"));
    active.release();
    await rejection;
    expect(await next).toBe("next");
  });

  it("rejects work canceled before starting", async () => {
    const gate = new ConcurrencyGate(1);
    const controller = new AbortController();
    controller.abort(new Error("Already canceled."));
    await expect(
      gate.run(controller.signal, () => {
        throw new Error("Canceled work must not start.");
      }),
    ).rejects.toThrow("Already canceled.");
    expect(
      await gate.run(new AbortController().signal, () => Promise.resolve(7)),
    ).toBe(7);
  });
});

function barrier() {
  let release: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  if (release === undefined) throw new Error("Missing barrier release.");
  return { promise, release };
}
