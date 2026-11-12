import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { guard } from './guard';

describe('guard (screen actions whose promise nobody awaits)', () => {
  it('reports a rejection to onError and resolves', async () => {
    const errors: unknown[] = [];
    await guard(() => Promise.reject(new Error('disk full')), (e) => errors.push(e));
    assert.equal(errors.length, 1);
    assert.match(String(errors[0]), /disk full/);
  });

  it('reports a synchronous throw to onError', async () => {
    const errors: unknown[] = [];
    await guard(() => {
      throw new Error('boom');
    }, (e) => errors.push(e));
    assert.equal(errors.length, 1);
  });

  it('does not call onError on success', async () => {
    const errors: unknown[] = [];
    let ran = 0;
    await guard(async () => {
      ran += 1;
    }, (e) => errors.push(e));
    assert.equal(ran, 1);
    assert.deepEqual(errors, []);
  });

  it('never rejects, even when onError throws or is omitted', async () => {
    await guard(() => Promise.reject(new Error('x')));
    await guard(
      () => Promise.reject(new Error('x')),
      () => {
        throw new Error('alert failed');
      },
    );
  });

  it('starts the task synchronously', () => {
    let ran = false;
    void guard(async () => {
      ran = true;
    });
    assert.equal(ran, true);
  });
});
