import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { announceLateSeal, announceSealed, type SealNoticeFx } from './sealNotice';

function fx(getBinderName: SealNoticeFx['getBinderName']) {
  const toasts: string[] = [];
  const order: string[] = [];
  const effects: SealNoticeFx & { refresh: () => void } = {
    getBinderName,
    toast: (m) => {
      toasts.push(m);
      order.push('toast');
    },
    t: (key, options) => (options ? `${key} ${JSON.stringify(options)}` : key),
    refresh: () => order.push('refresh'),
  };
  return { effects, toasts, order };
}

describe('announceSealed (App onDone toast)', () => {
  it('names the binder the card went into', async () => {
    const { effects, toasts } = fx(async () => 'Trip');
    await announceSealed('b1', effects);
    assert.deepEqual(toasts, ['pickBinder.sealedToast {"name":"Trip"}']);
  });

  it('still toasts, with the fallback title, when the binder lookup fails', async () => {
    const { effects, toasts } = fx(() => Promise.reject(new Error('storage unavailable')));
    await announceSealed('b1', effects); // must not reject
    assert.deepEqual(toasts, ['pickBinder.sealedToast {"name":"binderDetail.fallbackTitle"}']);
  });

  it('uses the fallback title for a binder that no longer exists', async () => {
    const { effects, toasts } = fx(async () => null);
    await announceSealed('b1', effects);
    assert.deepEqual(toasts, ['pickBinder.sealedToast {"name":"binderDetail.fallbackTitle"}']);
  });
});

describe('announceLateSeal (seal that settled after the user left the picker)', () => {
  it('refreshes the binder list and says where the card went', async () => {
    const { effects, toasts, order } = fx(async () => 'Trip');
    await announceLateSeal({ ok: true, cardId: 'c1', binderId: 'b1' }, effects);
    assert.deepEqual(toasts, ['pickBinder.lateSealedToast {"name":"Trip"}']);
    assert.deepEqual(order, ['refresh', 'toast']);
  });

  it('says the seal was not saved, without refreshing', async () => {
    const { effects, toasts, order } = fx(async () => 'Trip');
    await announceLateSeal({ ok: false }, effects);
    assert.deepEqual(toasts, ['pickBinder.lateFailedToast']);
    assert.deepEqual(order, ['toast']);
  });
});

describe('seal toasts when the binder was deleted meanwhile (card stored unsorted)', () => {
  it('says the card went to Uncategorized, without looking up a binder', async () => {
    let lookups = 0;
    const { effects, toasts } = fx(async () => {
      lookups += 1;
      return 'Trip';
    });
    await announceSealed(null, effects);
    assert.deepEqual(toasts, ['pickBinder.sealedUnsortedToast']);
    assert.equal(lookups, 0);
  });

  it('a late seal into a deleted binder refreshes and says it went to Uncategorized', async () => {
    const { effects, toasts, order } = fx(async () => 'Trip');
    await announceLateSeal({ ok: true, cardId: 'c1', binderId: null }, effects);
    assert.deepEqual(toasts, ['pickBinder.lateSealedUnsortedToast']);
    assert.deepEqual(order, ['refresh', 'toast']);
  });

  it('never rejects, even when the binder lookup throws synchronously', async () => {
    const { effects, toasts } = fx(() => {
      throw new Error('storage module missing');
    });
    await announceSealed('b1', effects);
    await announceLateSeal({ ok: true, cardId: 'c1', binderId: 'b1' }, effects);
    assert.deepEqual(toasts, [
      'pickBinder.sealedToast {"name":"binderDetail.fallbackTitle"}',
      'pickBinder.lateSealedToast {"name":"binderDetail.fallbackTitle"}',
    ]);
  });
});

describe('late seal whose binder was deleted after its row landed (seal that timed out, then landed)', () => {
  it('says Uncategorized, not the generic binder title, when the binder no longer exists', async () => {
    // deleteBinder moves that binder's cards to Uncategorized, and the stored row still names it.
    const { effects, toasts, order } = fx(async () => null);
    await announceLateSeal({ ok: true, cardId: 'c1', binderId: 'b1' }, effects);
    assert.deepEqual(toasts, ['pickBinder.lateSealedUnsortedToast']);
    assert.deepEqual(order, ['refresh', 'toast']);
  });

  it('a lookup that fails is not taken as a deleted binder (generic title)', async () => {
    const { effects, toasts } = fx(() => Promise.reject(new Error('storage unavailable')));
    await announceLateSeal({ ok: true, cardId: 'c1', binderId: 'b1' }, effects);
    assert.deepEqual(toasts, ['pickBinder.lateSealedToast {"name":"binderDetail.fallbackTitle"}']);
  });
});
