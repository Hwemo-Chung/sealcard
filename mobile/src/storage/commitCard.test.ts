import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { commitCard } from './commitCard';
import { SerialTimeoutError, createSerialQueue } from './serialQueue';

/** New tests fail within this instead of hanging when a regression drops a timeout or the queue. */
const HANG_MS = 10000;

type Db = { binders: string[]; cards: string[] };

/** AsyncStorage-like store: every read parses a fresh copy, like repository.readDb. */
function store() {
  let raw = JSON.stringify({ binders: [], cards: [] } satisfies Db);
  return {
    read: async (): Promise<Db> => JSON.parse(raw) as Db,
    write: async (db: Db) => {
      raw = JSON.stringify(db);
    },
    get: (): Db => JSON.parse(raw) as Db,
  };
}

function deferred() {
  let resolve: () => void = () => {};
  let reject: (e: Error) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('commitCard (repository.sealCard write order)', () => {
  it('keeps rows written while a slow copy was running (seal outlived the picker watchdog)', async () => {
    const db = store();
    const copy = deferred();
    const sealing = commitCard(
      { copy: () => copy.promise, read: db.read, write: db.write, discard: async () => {} },
      'card-1',
    );
    await flush();

    // The user left the stalled picker and created a binder meanwhile.
    const other = await db.read();
    other.binders.push('binder-new');
    await db.write(other);

    copy.resolve();
    await sealing;
    assert.deepEqual(db.get(), { binders: ['binder-new'], cards: ['card-1'] });
  });

  it('removes the copied file and rejects when the db write fails', async () => {
    const db = store();
    let discarded = 0;
    await assert.rejects(
      commitCard(
        {
          copy: async () => {},
          read: db.read,
          write: async () => {
            throw new Error('disk full');
          },
          discard: async () => {
            discarded += 1;
          },
        },
        'card-1',
      ),
      /disk full/,
    );
    assert.equal(discarded, 1);
    assert.deepEqual(db.get().cards, []);
  });

  it('removes the copied file when reading the db fails after the copy', async () => {
    let discarded = 0;
    await assert.rejects(
      commitCard<string, Db>(
        {
          copy: async () => {},
          read: async () => {
            throw new Error('storage unavailable');
          },
          write: async () => {},
          discard: async () => {
            discarded += 1;
          },
        },
        'card-1',
      ),
      /storage unavailable/,
    );
    assert.equal(discarded, 1);
  });

  it('writes nothing when the copy fails', async () => {
    const db = store();
    let writes = 0;
    await assert.rejects(
      commitCard(
        {
          copy: async () => {
            throw new Error('no space');
          },
          read: db.read,
          write: async (d) => {
            writes += 1;
            await db.write(d);
          },
          discard: async () => {},
        },
        'card-1',
      ),
      /no space/,
    );
    assert.equal(writes, 0);
  });

  it('removes a partially copied file when the copy itself fails', async () => {
    let discarded = 0;
    await assert.rejects(
      commitCard<string, Db>(
        {
          copy: async () => {
            throw new Error('no space');
          },
          read: async () => ({ binders: [], cards: [] }),
          write: async () => {},
          discard: async () => {
            discarded += 1;
          },
        },
        'card-1',
      ),
      /no space/,
    );
    assert.equal(discarded, 1);
  });

  it('keeps the original error when removing the copied file also fails', async () => {
    await assert.rejects(
      commitCard<string, Db>(
        {
          copy: async () => {},
          read: async () => ({ binders: [], cards: [] }),
          write: async () => {
            throw new Error('disk full');
          },
          discard: async () => {
            throw new Error('file busy');
          },
        },
        'card-1',
      ),
      /disk full/,
    );
  });

  it('runs only read→push→write inside the exclusive section, after the copy', async () => {
    const db = store();
    const order: string[] = [];
    await commitCard(
      {
        copy: async () => {
          order.push('copy');
        },
        read: async () => {
          order.push('read');
          return db.read();
        },
        write: async (d) => {
          order.push('write');
          await db.write(d);
        },
        discard: async () => {},
        exclusive: async (task) => {
          order.push('enter');
          try {
            return await task();
          } finally {
            order.push('leave');
          }
        },
      },
      'card-1',
    );
    assert.deepEqual(order, ['copy', 'enter', 'read', 'write', 'leave']);
    assert.deepEqual(db.get().cards, ['card-1']);
  });
});

describe('commitCard row placement and timed-out writes', () => {
  it('writes and returns the row place() picks for the snapshot read in the exclusive section', { timeout: HANG_MS }, async () => {
    const db = store();
    await db.write({ binders: ['b-live'], cards: [] });
    const seen: Db[] = [];
    const row = await commitCard<string, Db>(
      {
        copy: async () => {},
        read: db.read,
        write: db.write,
        discard: async () => {},
        place: (snapshot, card) => {
          seen.push(JSON.parse(JSON.stringify(snapshot)) as Db); // copy: the row is pushed afterwards
          return snapshot.binders.includes('b-gone') ? card : `${card}@unsorted`;
        },
      },
      'card-1',
    );
    assert.equal(row, 'card-1@unsorted');
    assert.deepEqual(db.get().cards, ['card-1@unsorted']);
    assert.deepEqual(seen, [{ binders: ['b-live'], cards: [] }]);
  });

  it('keeps the file and returns the row when a write that outlived the queue limit lands later', { timeout: HANG_MS }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const db = store();
    const write = deferred();
    let discarded = 0;
    let settled = 'pending';
    const sealing = commitCard<string, Db>(
      {
        copy: async () => {},
        read: db.read,
        write: async (d) => {
          await write.promise;
          await db.write(d);
        },
        discard: async () => {
          discarded += 1;
        },
        exclusive: createSerialQueue(),
      },
      'card-1',
    );
    void sealing.then(
      () => {
        settled = 'resolved';
      },
      () => {
        settled = 'rejected';
      },
    );
    await flush();
    await flush();
    t.mock.timers.tick(15000);
    await flush();
    assert.equal(settled, 'pending', 'the write may still land: wait for it');
    assert.equal(discarded, 0);

    write.resolve();
    assert.equal(await sealing, 'card-1');
    assert.equal(discarded, 0, 'the row landed, so its image must stay');
    assert.deepEqual(db.get().cards, ['card-1']);
  });


  it('returns the placed row, not the card it was given, when a timed-out write lands later', { timeout: HANG_MS }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const db = store();
    const write = deferred();
    let discarded = 0;
    let settled = 'pending';
    const sealing = commitCard<string, Db>(
      {
        copy: async () => {},
        read: db.read,
        write: async (d) => {
          await write.promise;
          await db.write(d);
        },
        discard: async () => {
          discarded += 1;
        },
        place: (_snapshot, card) => `${card}@unsorted`, // its binder was deleted meanwhile
        exclusive: createSerialQueue(),
      },
      'card-1',
    );
    void sealing.then(
      () => {
        settled = 'resolved';
      },
      () => {
        settled = 'rejected';
      },
    );
    await flush();
    await flush();
    t.mock.timers.tick(15000);
    await flush();
    assert.equal(settled, 'pending', 'timed out with the write in flight');

    write.resolve();
    assert.equal(await sealing, 'card-1@unsorted', 'the caller is told where the row really went');
    assert.deepEqual(db.get().cards, ['card-1@unsorted']);
    assert.equal(discarded, 0);
  });
  it('removes the file when that late write fails', { timeout: HANG_MS }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const write = deferred();
    let discarded = 0;
    const sealing = commitCard<string, Db>(
      {
        copy: async () => {},
        read: async () => ({ binders: [], cards: [] }),
        write: () => write.promise,
        discard: async () => {
          discarded += 1;
        },
        exclusive: createSerialQueue(),
      },
      'card-1',
    );
    void sealing.catch(() => undefined);
    await flush();
    await flush();
    t.mock.timers.tick(15000);
    await flush();
    write.reject(new Error('disk full'));
    await assert.rejects(sealing);
    assert.equal(discarded, 1);
  });

  it('removes the file when the exclusive section timed out before writing', { timeout: HANG_MS }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let discarded = 0;
    let writes = 0;
    const read = deferred();
    const sealing = commitCard<string, Db>(
      {
        copy: async () => {},
        read: async () => {
          await read.promise;
          return { binders: [], cards: [] };
        },
        write: async () => {
          writes += 1;
        },
        discard: async () => {
          discarded += 1;
        },
        exclusive: createSerialQueue(),
      },
      'card-1',
    );
    void sealing.catch(() => undefined);
    await flush();
    await flush();
    t.mock.timers.tick(15000);
    await assert.rejects(sealing, SerialTimeoutError);
    assert.equal(discarded, 1);
    read.resolve(); // the read returns late: the fenced task must not write
    await flush();
    await flush();
    assert.equal(writes, 0);
  });
});
