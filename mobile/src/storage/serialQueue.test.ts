import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SERIAL_TASK_TIMEOUT_MS, SerialTimeoutError, createSerialQueue } from './serialQueue';

/** New tests fail within this instead of hanging when a regression drops a timeout or the queue. */
const HANG_MS = 10000;

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function deferred<T>() {
  let resolve: (v: T) => void = () => {};
  let reject: (e: Error) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createSerialQueue (one db read-modify-write at a time)', () => {
  it('starts the next task only after the previous one settled, in call order', async () => {
    const serial = createSerialQueue();
    const started: string[] = [];
    const a = deferred<string>();
    const b = deferred<string>();

    const pa = serial(() => {
      started.push('a');
      return a.promise;
    });
    const pb = serial(() => {
      started.push('b');
      return b.promise;
    });
    await flush();
    assert.deepEqual(started, ['a']);

    a.resolve('A');
    assert.equal(await pa, 'A');
    await flush();
    assert.deepEqual(started, ['a', 'b']);
    b.resolve('B');
    assert.equal(await pb, 'B');
  });

  it('rejects only the failing task and keeps running later ones', async () => {
    const serial = createSerialQueue();
    const failing = serial(async () => {
      throw new Error('disk full');
    });
    const next = serial(async () => 'ok');
    await assert.rejects(failing, /disk full/);
    assert.equal(await next, 'ok');
  });

  it('treats a task that throws synchronously as a rejection', async () => {
    const serial = createSerialQueue();
    await assert.rejects(
      serial(() => {
        throw new Error('boom');
      }),
      /boom/,
    );
    assert.equal(await serial(async () => 1), 1);
  });
});

describe('createSerialQueue timeout (a stuck storage call must not block every later write)', () => {
  it('pins the per-task limit at 15 s', { timeout: HANG_MS }, () => {
    assert.equal(SERIAL_TASK_TIMEOUT_MS, 15000);
  });

  it('rejects a task still running after 15 s and runs the next one', { timeout: HANG_MS }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const serial = createSerialQueue();
    let outcome = 'pending';
    const stuck = serial(() => new Promise<string>(() => {}));
    void stuck.then(
      () => {
        outcome = 'resolved';
      },
      (e) => {
        outcome = e instanceof SerialTimeoutError ? 'timeout' : `other: ${String(e)}`;
      },
    );
    const next = serial(async () => 'next');
    await flush();

    t.mock.timers.tick(14999);
    await flush();
    assert.equal(outcome, 'pending', 'not before 15000 ms');

    t.mock.timers.tick(1);
    await flush();
    assert.equal(outcome, 'timeout');
    assert.equal(await next, 'next');
  });

  it('starts the 15 s from when the task starts, not from when it was queued', { timeout: HANG_MS }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const serial = createSerialQueue();
    const first = deferred<string>();
    const pFirst = serial(() => first.promise);
    let second = 'pending';
    void serial(() => new Promise<string>(() => {})).catch(() => {
      second = 'timeout';
    });
    await flush();

    t.mock.timers.tick(10000);
    first.resolve('A');
    assert.equal(await pFirst, 'A');
    await flush();

    t.mock.timers.tick(14999); // 24999 ms after queueing, 14999 ms after starting
    await flush();
    assert.equal(second, 'pending');
    t.mock.timers.tick(1);
    await flush();
    assert.equal(second, 'timeout');
  });

  it('never lets a timed-out task start its write later (no stale snapshot over newer rows)', { timeout: HANG_MS }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const serial = createSerialQueue();
    const writes: string[] = [];
    const gate = deferred<void>();
    const late = serial(async (lease) => {
      await gate.promise; // e.g. its read came back after the limit
      await lease.write(async () => {
        writes.push('stale');
      });
    });
    void late.catch(() => undefined);
    await flush();
    t.mock.timers.tick(15000);
    await assert.rejects(late, SerialTimeoutError);

    await serial(async (lease) => {
      await lease.write(async () => {
        writes.push('newer');
      });
    });
    gate.resolve();
    await flush();
    await flush();
    assert.deepEqual(writes, ['newer']);
  });

  it('hands over a write that was already started (its outcome is not known yet)', { timeout: HANG_MS }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const serial = createSerialQueue();
    const write = deferred<void>();
    const task = serial(async (lease) => {
      await lease.write(() => write.promise);
      return 'written';
    });
    void task.catch(() => undefined);
    await flush();
    t.mock.timers.tick(15000);
    const err = await task.then(
      () => null,
      (e: unknown) => e,
    );
    assert.ok(err instanceof SerialTimeoutError);
    assert.ok(err.pendingWrite, 'the started write is reported');
    let landed = false;
    void err.pendingWrite.then(() => {
      landed = true;
    });
    await flush();
    assert.equal(landed, false);
    write.resolve();
    await flush();
    assert.equal(landed, true);
  });

  it('reports no pending write when the task timed out before writing', { timeout: HANG_MS }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const serial = createSerialQueue();
    const task = serial(() => new Promise<void>(() => {}));
    void task.catch(() => undefined);
    await flush();
    t.mock.timers.tick(15000);
    const err = await task.then(
      () => null,
      (e: unknown) => e,
    );
    assert.ok(err instanceof SerialTimeoutError);
    assert.equal(err.pendingWrite, null);
  });

  it('keeps a task that settles in time unaffected by its timer', { timeout: HANG_MS }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const serial = createSerialQueue();
    const d = deferred<string>();
    const p = serial(() => d.promise);
    await flush();
    t.mock.timers.tick(14999);
    d.resolve('ok');
    assert.equal(await p, 'ok');
    t.mock.timers.tick(10000);
    await flush();
    assert.equal(await serial(async () => 'after'), 'after');
  });
});
