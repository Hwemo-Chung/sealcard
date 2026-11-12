import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bindersView,
  createRowsLoader,
  loadBinderRows,
  type BinderRow,
  type BinderRowsApi,
  type RowsState,
} from './binderRows';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function api(over: Partial<BinderRowsApi> = {}): BinderRowsApi {
  return {
    listBinders: async () => [
      { id: 'b2', name: 'Trip' },
      { id: 'b1', name: 'Home' },
    ],
    countCardsInBinder: async (id) => (id === 'b2' ? 3 : id === 'b1' ? 0 : 2),
    latestThumbInBinder: async (id) => (id === 'b1' ? null : `thumb-${id ?? 'none'}`),
    ...over,
  };
}

const row = (id: string | null, name: string): BinderRow => ({ id, name, count: 1, thumb: null });

describe('loadBinderRows (binder list rows)', () => {
  it('lists binders in repository order and appends Uncategorized when it has cards', async () => {
    assert.deepEqual(await loadBinderRows(api(), 'Uncategorized'), [
      { id: 'b2', name: 'Trip', count: 3, thumb: 'thumb-b2' },
      { id: 'b1', name: 'Home', count: 0, thumb: null },
      { id: null, name: 'Uncategorized', count: 2, thumb: 'thumb-none' },
    ]);
  });

  it('omits Uncategorized when it is empty', async () => {
    const rows = await loadBinderRows(
      api({ countCardsInBinder: async (id) => (id === null ? 0 : 1) }),
      'Uncategorized',
    );
    assert.deepEqual(
      rows.map((r) => r.id),
      ['b2', 'b1'],
    );
  });
});

describe('createRowsLoader (BindersScreen reload)', () => {
  function harness(load: () => Promise<BinderRow[]>) {
    const states: RowsState[] = [];
    const reload = createRowsLoader(load, (s) => states.push(s));
    return { states, reload };
  }

  it('ends in an error state, not stuck loading, when the read rejects', async () => {
    const { states, reload } = harness(() => Promise.reject(new Error('storage unavailable')));
    await reload(); // must not reject
    assert.deepEqual(states, [
      { status: 'loading', rows: [] },
      { status: 'error', rows: [] },
    ]);
    assert.equal(bindersView(states[states.length - 1]), 'error');
  });

  it('treats a load that throws synchronously as a failure', async () => {
    const { states, reload } = harness(() => {
      throw new Error('boom');
    });
    await reload();
    assert.equal(states[states.length - 1].status, 'error');
  });

  it('shows the rows after a retry succeeds', async () => {
    let fail = true;
    const { states, reload } = harness(async () => {
      if (fail) throw new Error('storage unavailable');
      return [row('b1', 'Home')];
    });
    await reload();
    fail = false;
    await reload();
    assert.deepEqual(states[states.length - 1], { status: 'ready', rows: [row('b1', 'Home')] });
    assert.equal(bindersView(states[states.length - 1]), 'list');
  });

  it('ignores an earlier reload that finishes after a newer one', async () => {
    let releaseOld: (rows: BinderRow[]) => void = () => {};
    let calls = 0;
    const { states, reload } = harness(() => {
      calls += 1;
      if (calls === 1) return new Promise<BinderRow[]>((r) => (releaseOld = r));
      return Promise.resolve([row('b-new', 'New')]);
    });
    const older = reload();
    await reload();
    releaseOld([row('b-old', 'Old')]);
    await older;
    await flush();
    assert.deepEqual(states[states.length - 1], { status: 'ready', rows: [row('b-new', 'New')] });
  });

  it('keeps the shown rows while reloading', async () => {
    const { states, reload } = harness(async () => [row('b1', 'Home')]);
    await reload();
    await reload();
    assert.deepEqual(states[2], { status: 'loading', rows: [row('b1', 'Home')] });
  });

  it('keeps the last rows read when a later reload fails', async () => {
    let fail = false;
    const { states, reload } = harness(async () => {
      if (fail) throw new Error('storage unavailable');
      return [row('b1', 'Home')];
    });
    await reload();
    fail = true;
    await reload();
    assert.deepEqual(states[states.length - 1], { status: 'error', rows: [row('b1', 'Home')] });
  });
});

describe('bindersView', () => {
  it('maps each state to what the screen shows', () => {
    assert.equal(bindersView({ status: 'loading', rows: [] }), 'blank');
    assert.equal(bindersView({ status: 'loading', rows: [row('b1', 'Home')] }), 'list');
    assert.equal(bindersView({ status: 'ready', rows: [] }), 'empty');
    assert.equal(bindersView({ status: 'ready', rows: [row('b1', 'Home')] }), 'list');
    assert.equal(bindersView({ status: 'error', rows: [] }), 'error');
    assert.equal(bindersView({ status: 'error', rows: [row('b1', 'Home')] }), 'error');
  });
});
