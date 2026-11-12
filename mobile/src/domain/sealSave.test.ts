import assert from 'node:assert/strict';
import { describe, it, type TestContext } from 'node:test';

import { createSealSave, type SealPhase, type SealSaveHooks } from './sealSave';

/** Drain pending promise callbacks (setImmediate is not faked). */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
const never = <T>() => new Promise<T>(() => {});
const after = <T>(ms: number, value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
const failAfter = (ms: number) =>
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error('disk full')), ms));

function recorder() {
  const log = { phases: [] as SealPhase[], done: [] as string[], failed: 0 };
  const hooks: SealSaveHooks<string> = {
    phase: (p) => log.phases.push(p),
    done: (id) => log.done.push(id),
    failed: () => {
      log.failed += 1;
    },
  };
  return { log, hooks };
}

function fakeTimers(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  return t.mock.timers;
}

describe('createSealSave (binder picker "Done")', () => {
  it('starts one save per capture: a second press while saving is ignored', async () => {
    const seal = createSealSave();
    const { log, hooks } = recorder();
    let saves = 0;
    const save = () => {
      saves += 1;
      return never<string>();
    };

    assert.equal(seal.start(save, hooks), true);
    assert.equal(seal.start(save, hooks), false);
    assert.equal(saves, 1);
    assert.deepEqual(log.phases, ['saving']);
  });

  it('completes a save that finishes in time and clears the 20 s watchdog', async (t) => {
    const timers = fakeTimers(t);
    const seal = createSealSave();
    const { log, hooks } = recorder();

    seal.start(() => after(5000, 'c1'), hooks);
    timers.tick(5000);
    await flush();
    assert.deepEqual(log.done, ['c1']);

    timers.tick(20000);
    await flush();
    assert.deepEqual(log.phases, ['saving'], 'stays busy until navigation; never "stalled"');
  });

  it('frees Cancel/back after 20 s without a result but keeps the lock (no second save)', async (t) => {
    const timers = fakeTimers(t);
    const seal = createSealSave();
    const { log, hooks } = recorder();
    let saves = 0;
    const save = () => {
      saves += 1;
      return never<string>();
    };

    seal.start(save, hooks);
    timers.tick(19999);
    await flush();
    assert.deepEqual(log.phases, ['saving']);

    timers.tick(1);
    await flush();
    assert.deepEqual(log.phases, ['saving', 'stalled']);
    assert.equal(seal.start(save, hooks), false, 'Done after the stall must not start a second save');
    assert.equal(saves, 1);
  });

  it('still finishes the seal when a stalled save completes while the picker is shown', async (t) => {
    const timers = fakeTimers(t);
    const seal = createSealSave();
    const { log, hooks } = recorder();

    seal.start(() => after(25000, 'c1'), hooks);
    timers.tick(20000);
    await flush();
    timers.tick(5000);
    await flush();

    assert.deepEqual(log.done, ['c1']);
    // Busy again before navigating, so back is swallowed until the new screen is up.
    assert.deepEqual(log.phases, ['saving', 'stalled', 'saving']);
  });

  it('ignores a stalled save that completes after the user left the picker', async (t) => {
    const timers = fakeTimers(t);
    const seal = createSealSave();
    const { log, hooks } = recorder();

    seal.start(() => after(25000, 'c1'), hooks);
    timers.tick(20000);
    await flush();
    seal.dispose(); // Cancel / back after the stall unmounts the picker
    timers.tick(5000);
    await flush();

    assert.deepEqual(log.done, [], 'must not navigate away from wherever the user went');
    assert.deepEqual(log.phases, ['saving', 'stalled']);
    assert.equal(log.failed, 0);
  });

  it('releases the lock when the save fails so Done can retry', async (t) => {
    const timers = fakeTimers(t);
    const seal = createSealSave();
    const { log, hooks } = recorder();

    seal.start(() => failAfter(1000), hooks);
    timers.tick(1000);
    await flush();
    assert.deepEqual(log.phases, ['saving', 'idle']);
    assert.equal(log.failed, 1);

    timers.tick(20000);
    await flush();
    assert.deepEqual(log.phases, ['saving', 'idle'], 'no stall after a failure');
    assert.equal(seal.start(() => after(10, 'c2'), hooks), true);
  });

  it('reports a failure that arrives after the stall and allows a retry', async (t) => {
    const timers = fakeTimers(t);
    const seal = createSealSave();
    const { log, hooks } = recorder();

    seal.start(() => failAfter(30000), hooks);
    timers.tick(20000);
    await flush();
    timers.tick(10000);
    await flush();

    assert.deepEqual(log.phases, ['saving', 'stalled', 'idle']);
    assert.equal(log.failed, 1);
    assert.equal(seal.start(() => never<string>(), hooks), true);
  });

  it('treats a save that throws synchronously as a failure', () => {
    const seal = createSealSave();
    const { log, hooks } = recorder();
    seal.start(() => {
      throw new Error('boom');
    }, hooks);
    return flush().then(() => {
      assert.deepEqual(log.phases, ['saving', 'idle']);
      assert.equal(log.failed, 1);
    });
  });

  it('reports a save that succeeds after the user left the picker through the late hook only', async (t) => {
    const timers = fakeTimers(t);
    const seal = createSealSave();
    const { log, hooks } = recorder();
    const late: unknown[] = [];

    seal.start(() => after(25000, 'c1'), { ...hooks, late: (o) => late.push(o) });
    timers.tick(20000);
    await flush();
    seal.dispose(); // Cancel after the stall
    timers.tick(5000);
    await flush();

    assert.deepEqual(late, [{ ok: true, result: 'c1' }]);
    assert.deepEqual(log.done, [], 'never navigates from wherever the user went');
    assert.deepEqual(log.phases, ['saving', 'stalled']);
  });

  it('reports a save that fails after the user left the picker through the late hook only', async (t) => {
    const timers = fakeTimers(t);
    const seal = createSealSave();
    const { log, hooks } = recorder();
    const late: unknown[] = [];

    seal.start(() => failAfter(30000), { ...hooks, late: (o) => late.push(o) });
    timers.tick(20000);
    await flush();
    seal.dispose();
    timers.tick(10000);
    await flush();

    assert.deepEqual(late, [{ ok: false }]);
    assert.equal(log.failed, 0, 'no picker alert over another screen');
    assert.deepEqual(log.phases, ['saving', 'stalled'], 'no phase change after leaving');
  });

  it('does not use the late hook while the picker is still shown', async (t) => {
    const timers = fakeTimers(t);
    const seal = createSealSave();
    const { log, hooks } = recorder();
    const late: unknown[] = [];

    seal.start(() => after(25000, 'c1'), { ...hooks, late: (o) => late.push(o) });
    timers.tick(25000);
    await flush();
    assert.deepEqual(log.done, ['c1']);
    assert.deepEqual(late, []);
  });

  it('does not fire the watchdog after the picker is gone', async (t) => {
    const timers = fakeTimers(t);
    const seal = createSealSave();
    const { log, hooks } = recorder();

    seal.start(() => never<string>(), hooks);
    seal.dispose();
    timers.tick(20000);
    await flush();

    assert.deepEqual(log.phases, ['saving']);
  });
});

describe('createSealSave lock (one seal per capture)', () => {
  it('keeps Done locked after a successful save: the same capture cannot be sealed twice', async () => {
    const seal = createSealSave();
    const { log, hooks } = recorder();
    let saves = 0;
    seal.start(async () => {
      saves += 1;
      return 'c1';
    }, hooks);
    await flush();
    assert.deepEqual(log.done, ['c1']);

    assert.equal(
      seal.start(async () => {
        saves += 1;
        return 'c2';
      }, hooks),
      false,
    );
    assert.equal(saves, 1);
  });

  it('refuses to start a save once the picker is gone', () => {
    const seal = createSealSave();
    const { log, hooks } = recorder();
    let saves = 0;
    seal.dispose();
    assert.equal(
      seal.start(() => {
        saves += 1;
        return never<string>();
      }, hooks),
      false,
    );
    assert.equal(saves, 0);
    assert.deepEqual(log.phases, []);
  });

  it('clears the stall watchdog when the picker is left (no timer outlives the screen)', (t) => {
    const set = t.mock.method(globalThis, 'setTimeout');
    const clear = t.mock.method(globalThis, 'clearTimeout');
    const seal = createSealSave(3000);
    const { hooks } = recorder();
    seal.start(() => never<string>(), hooks);
    assert.equal(set.mock.callCount(), 1);
    const handle = set.mock.calls[0].result;
    seal.dispose();
    assert.ok(
      clear.mock.calls.some((c) => c.arguments[0] === handle),
      'dispose must clear the watchdog it started',
    );
  });
});
