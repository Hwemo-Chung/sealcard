import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { SealPhase } from '../domain/sealSave';
import type { LateSealOutcome } from './sealNotice';
import { pickerSealHooks } from './pickerSeal';

function recorder() {
  const log = {
    phases: [] as SealPhase[],
    done: [] as [string, string | null][],
    failed: 0,
    late: [] as LateSealOutcome[],
  };
  const hooks = pickerSealHooks({
    phase: (p) => log.phases.push(p),
    done: (cardId, binderId) => log.done.push([cardId, binderId]),
    failed: () => {
      log.failed += 1;
    },
    late: (o) => log.late.push(o),
  });
  return { log, hooks };
}

describe('pickerSealHooks (binder picker → App wiring)', () => {
  it('navigates to the binder the card was stored in', () => {
    const { log, hooks } = recorder();
    hooks.done({ id: 'c1', binderId: 'b1' });
    assert.deepEqual(log.done, [['c1', 'b1']]);
  });

  it('navigates to Uncategorized when the card was stored unsorted (its binder was deleted)', () => {
    const { log, hooks } = recorder();
    hooks.done({ id: 'c1', binderId: null });
    assert.deepEqual(log.done, [['c1', null]]);
  });

  it('reports a late success with the stored binder, including unsorted', () => {
    const { log, hooks } = recorder();
    assert.ok(hooks.late, 'the late hook must be wired');
    hooks.late({ ok: true, result: { id: 'c1', binderId: 'b1' } });
    hooks.late({ ok: true, result: { id: 'c2', binderId: null } });
    assert.deepEqual(log.late, [
      { ok: true, cardId: 'c1', binderId: 'b1' },
      { ok: true, cardId: 'c2', binderId: null },
    ]);
  });

  it('reports a late failure', () => {
    const { log, hooks } = recorder();
    hooks.late?.({ ok: false });
    assert.deepEqual(log.late, [{ ok: false }]);
  });

  it('passes phase changes and in-screen failures through', () => {
    const { log, hooks } = recorder();
    hooks.phase('saving');
    hooks.phase('stalled');
    hooks.failed();
    assert.deepEqual(log.phases, ['saving', 'stalled']);
    assert.equal(log.failed, 1);
  });
});
