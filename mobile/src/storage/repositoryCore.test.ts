import assert from 'node:assert/strict';
import { describe, it, type TestContext } from 'node:test';

import { DEFAULT_SETTINGS, type DbSnapshot } from '../domain/types';
import { DB_KEY, createRepository, type RepositoryIo, type SealInput } from './repositoryCore';
import { SerialTimeoutError } from './serialQueue';
import { pickerSealHooks } from '../navigation/pickerSeal';
import { announceLateSeal } from '../navigation/sealNotice';

/** New tests fail within this instead of hanging when a regression drops a timeout or the queue. */
const HANG_MS = 10000;

/** Let pending async steps run (every fake IO call yields a macrotask). */
async function settle(rounds = 20) {
  for (let i = 0; i < rounds; i += 1) await new Promise<void>((r) => setImmediate(r));
}

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * AsyncStorage + file system fake. Every call yields, so concurrent repository
 * calls interleave like they do on the device; a write or a copy can be held open.
 */
function fakeIo(seed?: DbSnapshot) {
  let raw: string | null = seed ? JSON.stringify(seed) : null;
  const files = new Set<string>();
  let heldWrite: Promise<void> | null = null;
  let heldCopy: Promise<void> | null = null;
  let failCopy: Error | null = null;
  let failWrite: Error | null = null;
  const yieldOnce = () => new Promise<void>((r) => setImmediate(r));

  const io: RepositoryIo = {
    getItem: async (key) => {
      await yieldOnce();
      return key === DB_KEY ? raw : null;
    },
    setItem: async (key, value) => {
      await yieldOnce();
      if (heldWrite) {
        const gate = heldWrite;
        heldWrite = null;
        await gate;
      }
      if (failWrite) {
        const e = failWrite;
        failWrite = null;
        throw e;
      }
      if (key === DB_KEY) raw = value;
    },
    documentDirectory: () => 'file:///docs/',
    exists: async (uri) => {
      await yieldOnce();
      return uri.endsWith('/') || files.has(uri);
    },
    makeDirectory: async () => {
      await yieldOnce();
    },
    copy: async (_from, to) => {
      await yieldOnce();
      if (heldCopy) await heldCopy;
      files.add(to); // a failing copy may still leave a partial file behind
      if (failCopy) throw failCopy;
    },
    remove: async (uri) => {
      await yieldOnce();
      files.delete(uri);
    },
  };

  return {
    io,
    files,
    db: (): DbSnapshot => JSON.parse(raw ?? 'null') as DbSnapshot,
    /** The next setItem waits until the returned function is called. */
    holdNextWrite: () => {
      const d = deferred();
      heldWrite = d.promise;
      return d.resolve;
    },
    holdCopy: () => {
      const d = deferred();
      heldCopy = d.promise;
      return d.resolve;
    },
    failNextCopy: (e: Error) => {
      failCopy = e;
    },
    failNextWrite: (e: Error) => {
      failWrite = e;
    },
  };
}

const input = (binderId = 'b1'): SealInput => ({
  binderId,
  templateId: 'polaroid',
  dateFormatId: 'dot',
  compositeUri: 'file:///cache/composite.jpg',
  width: 300,
  height: 380,
  sealedAt: '2026-11-11T00:00:00.000Z',
});

/** One binder with one card in it. */
function seeded(): DbSnapshot {
  return {
    version: 1,
    binders: [{ id: 'b1', name: 'Home', createdAt: '2026-11-01T00:00:00.000Z' }],
    cards: [
      {
        id: 'c1',
        binderId: 'b1',
        sealedAt: '2026-11-01T00:00:00.000Z',
        templateId: 'polaroid',
        dateFormatId: 'dot',
        imagePath: 'file:///docs/sealcard/cards/c1.jpg',
        width: 300,
        height: 380,
      },
    ],
    settings: { ...DEFAULT_SETTINGS },
  };
}

describe('repository writes are serialized (no lost binder or card rows)', () => {
  it('keeps a binder created while a seal is writing the db (reviewer repro)', async () => {
    const fake = fakeIo();
    const repo = createRepository(fake.io);

    const release = fake.holdNextWrite();
    const sealing = repo.sealCard(input());
    await settle(); // the seal has read the db and its write is in flight
    const creating = repo.createBinder('Trip');
    await settle();
    release();
    await Promise.all([sealing, creating]);

    const db = fake.db();
    assert.deepEqual(
      { binders: db.binders.map((b) => b.name), cards: db.cards.length },
      { binders: ['Trip'], cards: 1 },
    );
  });

  const writes: {
    name: string;
    run: (repo: ReturnType<typeof createRepository>) => Promise<unknown>;
    applied: (db: DbSnapshot) => boolean;
  }[] = [
    {
      name: 'updateSettings',
      run: (r) => r.updateSettings({ showLocation: true }),
      applied: (db) => db.settings.showLocation === true,
    },
    {
      name: 'createBinder',
      run: (r) => r.createBinder('First'),
      applied: (db) => db.binders.some((b) => b.name === 'First'),
    },
    {
      name: 'renameBinder',
      run: (r) => r.renameBinder('b1', 'Renamed'),
      applied: (db) => db.binders.find((b) => b.id === 'b1')?.name === 'Renamed',
    },
    {
      name: 'deleteBinder',
      run: (r) => r.deleteBinder('b1'),
      applied: (db) =>
        !db.binders.some((b) => b.id === 'b1') &&
        db.cards.find((c) => c.id === 'c1')?.binderId === null,
    },
    {
      name: 'moveCard',
      run: (r) => r.moveCard('c1', null),
      applied: (db) => db.cards.find((c) => c.id === 'c1')?.binderId === null,
    },
    {
      name: 'destroyCard',
      run: (r) => r.destroyCard('c1'),
      applied: (db) => !db.cards.some((c) => c.id === 'c1'),
    },
    {
      name: 'sealCard',
      run: (r) => r.sealCard(input()),
      applied: (db) => db.cards.length === 2,
    },
  ];

  for (const w of writes) {
    it(`${w.name} and a binder created during its write both survive`, async () => {
      const fake = fakeIo(seeded());
      const repo = createRepository(fake.io);

      const release = fake.holdNextWrite();
      const first = w.run(repo);
      await settle();
      const creating = repo.createBinder('Other');
      await settle();
      release();
      await Promise.all([first, creating]);

      const db = fake.db();
      assert.ok(w.applied(db), `${w.name} was lost: ${JSON.stringify(db)}`);
      assert.ok(
        db.binders.some((b) => b.name === 'Other'),
        `binder created during ${w.name} was lost: ${JSON.stringify(db)}`,
      );
    });
  }

  it('reads the db after the file copy: a binder created during a slow copy survives', async () => {
    const fake = fakeIo();
    const repo = createRepository(fake.io);

    const release = fake.holdCopy();
    const sealing = repo.sealCard(input());
    await settle(); // copy in progress (a stalled save the user walked away from)
    let created = false;
    const creating = repo.createBinder('Trip').then(() => {
      created = true;
    });
    await settle();
    try {
      assert.equal(created, true, 'a slow copy must not hold the write queue');
    } finally {
      release();
    }
    await Promise.all([sealing, creating]);

    const db = fake.db();
    assert.deepEqual(
      { binders: db.binders.map((b) => b.name), cards: db.cards.length },
      { binders: ['Trip'], cards: 1 },
    );
  });

  it('removes a partially copied file when the copy fails, and writes nothing', async () => {
    const fake = fakeIo();
    const repo = createRepository(fake.io);
    fake.failNextCopy(new Error('no space'));

    await assert.rejects(repo.sealCard(input()), /no space/);
    assert.deepEqual([...fake.files], []);
    assert.equal(fake.db(), null);
  });

  it('keeps writing after a failed write (the queue is not poisoned)', async () => {
    const fake = fakeIo();
    const repo = createRepository(fake.io);
    fake.failNextWrite(new Error('disk full'));

    await assert.rejects(repo.createBinder('Lost'), /disk full/);
    await repo.createBinder('Kept');
    assert.deepEqual(
      fake.db().binders.map((b) => b.name),
      ['Kept'],
    );
  });
});

/**
 * Storage the way AsyncStorage runs it: every get/set is served in submission
 * order (Android SerialExecutor), so a held set also holds every later get/set.
 * Keyed by literal strings, independent of the DB_KEY export.
 */
function fifoIo(seed?: unknown) {
  const kv = new Map<string, string>();
  if (seed !== undefined) kv.set('sealcard/db/v1', JSON.stringify(seed));
  const files = new Set<string>();
  const dirsMade: string[] = [];
  const copies: { from: string; to: string }[] = [];
  let chain: Promise<unknown> = Promise.resolve();
  /** Resolves with the error the held set fails with (null: it lands). */
  let heldSet: Promise<Error | null> | null = null;
  let heldGet: Promise<void> | null = null;
  const tick = () => new Promise<void>((r) => setImmediate(r));
  const inOrder = <T>(op: () => Promise<T>): Promise<T> => {
    const run = chain.then(op);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
  const io: RepositoryIo = {
    getItem: (key) =>
      inOrder(async () => {
        await tick();
        if (heldGet) {
          const gate = heldGet;
          heldGet = null;
          await gate;
        }
        return kv.get(key) ?? null;
      }),
    setItem: (key, value) =>
      inOrder(async () => {
        await tick();
        if (heldSet) {
          const gate = heldSet;
          heldSet = null;
          const failure = await gate;
          if (failure) throw failure;
        }
        kv.set(key, value);
      }),
    documentDirectory: () => 'file:///docs/',
    exists: async (uri) => {
      await tick();
      return dirsMade.includes(uri) || files.has(uri);
    },
    makeDirectory: async (uri) => {
      await tick();
      dirsMade.push(uri);
    },
    copy: async (from, to) => {
      await tick();
      copies.push({ from, to });
      files.add(to);
    },
    remove: async (uri) => {
      await tick();
      files.delete(uri);
    },
  };
  const hold = () => {
    const d = deferred();
    return d;
  };
  return {
    io,
    kv,
    files,
    dirsMade,
    copies,
    db: () => JSON.parse(kv.get('sealcard/db/v1') ?? 'null') as DbSnapshot,
    /** The next set waits; the returned function lets it land, or fail with `failure`. */
    holdNextWrite: () => {
      let release: (failure: Error | null) => void = () => {};
      heldSet = new Promise<Error | null>((r) => {
        release = r;
      });
      return (failure?: Error) => release(failure ?? null);
    },
    holdNextRead: () => {
      const d = hold();
      heldGet = d.promise;
      return d.resolve;
    },
  };
}

const card = (id: string, binderId: string | null, sealedAt: string) => ({
  id,
  binderId,
  sealedAt,
  templateId: 'polaroid' as const,
  dateFormatId: 'dot' as const,
  imagePath: `file:///docs/sealcard/cards/${id}.jpg`,
  width: 300,
  height: 380,
});

describe('storage format of existing installs (a refactor must not orphan their data)', () => {
  it('reads and writes the db under the literal key sealcard/db/v1', { timeout: HANG_MS }, async () => {
    assert.equal(DB_KEY, 'sealcard/db/v1');
    const fake = fifoIo({ ...seeded() });
    const repo = createRepository(fake.io);
    assert.deepEqual(
      (await repo.listBinders()).map((b) => b.id),
      ['b1'],
    );
    await repo.createBinder('Trip');
    assert.deepEqual([...fake.kv.keys()], ['sealcard/db/v1']);
    assert.deepEqual(
      fake.db().binders.map((b) => b.name).sort(),
      ['Home', 'Trip'],
    );
  });

  it('stores sealed images as <documentDirectory>sealcard/cards/<cardId>.jpg', { timeout: HANG_MS }, async () => {
    const fake = fifoIo(seeded());
    const repo = createRepository(fake.io);
    assert.equal(await repo.getCardsDir(), 'file:///docs/sealcard/cards/');
    assert.deepEqual(fake.dirsMade, ['file:///docs/sealcard/cards/']);
    const c = await repo.sealCard(input('b1'));
    assert.equal(c.imagePath, `file:///docs/sealcard/cards/${c.id}.jpg`);
    assert.deepEqual(fake.copies, [{ from: 'file:///cache/composite.jpg', to: c.imagePath }]);
    assert.equal(fake.db().cards.find((x) => x.id === c.id)?.imagePath, c.imagePath);
  });

  it('reads a version 1 db and treats any other version as empty', { timeout: HANG_MS }, async () => {
    const v1 = createRepository(fifoIo(seeded()).io);
    assert.equal((await v1.listCards()).length, 1);
    const v2 = createRepository(fifoIo({ ...seeded(), version: 2 }).io);
    assert.deepEqual(await v2.listBinders(), []);
    assert.deepEqual(await v2.listCards(), []);
    assert.deepEqual(await v2.getSettings(), DEFAULT_SETTINGS);
  });

  it('fills settings an older build never stored with defaults and keeps the stored ones', { timeout: HANG_MS }, async () => {
    const fake = fifoIo({
      version: 1,
      binders: [],
      cards: [],
      settings: { defaultTemplateId: 'neon', dateFormatId: 'ko' },
    });
    const repo = createRepository(fake.io);
    assert.deepEqual(await repo.getSettings(), {
      ...DEFAULT_SETTINGS,
      defaultTemplateId: 'neon',
      dateFormatId: 'ko',
    });
    await repo.updateSettings({ showLocation: true });
    assert.deepEqual(fake.db().settings, {
      ...DEFAULT_SETTINGS,
      defaultTemplateId: 'neon',
      dateFormatId: 'ko',
      showLocation: true,
    });
  });

  it('stores a sealed card under the binder chosen in the picker', { timeout: HANG_MS }, async () => {
    const fake = fifoIo(seeded());
    const repo = createRepository(fake.io);
    const c = await repo.sealCard(input('b1'));
    assert.equal(c.binderId, 'b1');
    assert.equal(fake.db().cards.find((x) => x.id === c.id)?.binderId, 'b1');
    assert.ok((await repo.listCards('b1')).some((x) => x.id === c.id));
  });

  it('lists only unsorted cards for binderId null', { timeout: HANG_MS }, async () => {
    const fake = fifoIo({
      ...seeded(),
      cards: [
        card('c1', 'b1', '2026-11-01T00:00:00.000Z'),
        card('u1', null, '2026-11-02T00:00:00.000Z'),
      ],
    });
    const repo = createRepository(fake.io);
    assert.deepEqual(
      (await repo.listCards(null)).map((c) => c.id),
      ['u1'],
    );
    assert.equal(await repo.countCardsInBinder(null), 1);
    assert.equal(await repo.latestThumbInBinder(null), 'file:///docs/sealcard/cards/u1.jpg');
  });

  it('lists binders and cards newest first', { timeout: HANG_MS }, async () => {
    const fake = fifoIo({
      ...seeded(),
      binders: [
        { id: 'old', name: 'Old', createdAt: '2026-08-01T00:00:00.000Z' },
        { id: 'new', name: 'New', createdAt: '2026-11-01T00:00:00.000Z' },
        { id: 'mid', name: 'Mid', createdAt: '2026-09-01T00:00:00.000Z' },
      ],
      cards: [
        card('c-old', 'mid', '2026-08-02T00:00:00.000Z'),
        card('c-new', 'mid', '2026-11-02T00:00:00.000Z'),
      ],
    });
    const repo = createRepository(fake.io);
    assert.deepEqual(
      (await repo.listBinders()).map((b) => b.id),
      ['new', 'mid', 'old'],
    );
    assert.deepEqual(
      (await repo.listCards('mid')).map((c) => c.id),
      ['c-new', 'c-old'],
    );
  });

  it('destroyCard clears the widget pointer to that card', { timeout: HANG_MS }, async () => {
    const fake = fifoIo({
      ...seeded(),
      settings: { ...DEFAULT_SETTINGS, widgetCardId: 'c1', widgetBinderId: 'b1' },
    });
    const repo = createRepository(fake.io);
    await repo.destroyCard('c1');
    assert.equal(fake.db().settings.widgetCardId, null);
    assert.equal(fake.db().settings.widgetBinderId, 'b1');
  });

  it('destroyCard deletes the image file', { timeout: HANG_MS }, async () => {
    const fake = fifoIo(seeded());
    fake.files.add('file:///docs/sealcard/cards/c1.jpg');
    const repo = createRepository(fake.io);
    await repo.destroyCard('c1');
    assert.deepEqual([...fake.files], []);
    assert.deepEqual(fake.db().cards, []);
  });
});

describe('late seal into a deleted binder (orphan card)', () => {
  it('stores the card unsorted when its binder was deleted while the copy ran', { timeout: HANG_MS }, async () => {
    const fake = fakeIo(seeded());
    const repo = createRepository(fake.io);
    const release = fake.holdCopy();
    const sealing = repo.sealCard(input('b1')); // stalled save; the user left the picker
    await settle();
    await repo.deleteBinder('b1'); // ...and deleted that binder
    release();
    const c = await sealing;

    assert.equal(c.binderId, null, 'the returned row says where the card went');
    assert.equal(fake.db().cards.find((x) => x.id === c.id)?.binderId, null);
    assert.ok(
      (await repo.listCards(null)).some((x) => x.id === c.id),
      'reachable from the binder list (Uncategorized)',
    );
  });

  it('checks the chosen binder, not just any binder: with two binders, deleting only the chosen one stores the card unsorted', { timeout: HANG_MS }, async () => {
    const fake = fakeIo({
      ...seeded(),
      binders: [
        { id: 'b1', name: 'Home', createdAt: '2026-11-01T00:00:00.000Z' },
        { id: 'b2', name: 'Trip', createdAt: '2026-11-02T00:00:00.000Z' },
      ],
    });
    const repo = createRepository(fake.io);
    const release = fake.holdCopy();
    const sealing = repo.sealCard(input('b1'));
    await settle();
    await repo.deleteBinder('b1'); // b2 is still there
    release();
    const c = await sealing;

    assert.equal(c.binderId, null);
    assert.equal(fake.db().cards.find((x) => x.id === c.id)?.binderId, null);
    const kept = await repo.sealCard(input('b2'));
    assert.equal(kept.binderId, 'b2', 'a card whose binder still exists stays in it');
  });
});

describe('storage calls that hang past the queue limit', () => {
  it('a hung db write during a seal: the queue moves on, the row lands once, its file stays, no row is lost', { timeout: HANG_MS }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const fake = fifoIo(seeded());
    const repo = createRepository(fake.io);
    const release = fake.holdNextWrite();
    let sealState = 'pending';
    const sealing = repo.sealCard(input('b1'));
    void sealing.then(
      () => {
        sealState = 'resolved';
      },
      () => {
        sealState = 'rejected';
      },
    );
    await settle();
    t.mock.timers.tick(15000); // the seal's write is still stuck
    await settle();
    const creating = repo.createBinder('Other'); // queue moved on; storage serves it after the stuck write
    await settle();
    assert.equal(sealState, 'pending', 'outcome unknown: the seal waits for its write');

    release();
    const c = await sealing;
    await creating;
    const db = fake.db();
    assert.equal(db.cards.filter((x) => x.id === c.id).length, 1);
    assert.ok(fake.files.has(c.imagePath), 'image kept for the row that landed');
    assert.ok(db.binders.some((b) => b.name === 'Other'));
    assert.ok(db.cards.some((x) => x.id === 'c1'));
  });

  // Changed (R2): this test used to assert that `first` rejects with SerialTimeoutError while
  // its write was still in flight. That pinned the bug: the user was told the binder was not
  // created, it landed anyway, and a retry made a duplicate. The queue-progress and
  // late-row parts are kept; `first` must now wait for its write.
  it('a write stuck past 15 s: the queue still runs the next one, the stuck caller waits for its write, the late row is kept', { timeout: HANG_MS }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const fake = fifoIo(seeded());
    let reads = 0;
    const getItem = fake.io.getItem;
    fake.io.getItem = (key) => {
      reads += 1;
      return getItem(key);
    };
    const repo = createRepository(fake.io);
    const release = fake.holdNextWrite();
    let firstState = 'pending';
    const first = repo.createBinder('A');
    void first.then(
      () => {
        firstState = 'resolved';
      },
      () => {
        firstState = 'rejected';
      },
    );
    await settle();
    t.mock.timers.tick(15000);
    await settle();

    const second = repo.createBinder('B');
    await settle();
    assert.equal(reads, 2, 'the queue moved on: the next write already asked storage for the db');
    assert.equal(firstState, 'pending', 'its write may still land: not reported as failed');
    release();
    const a = await first;
    await second;
    assert.deepEqual(
      fake.db().binders.map((b) => b.name).sort(),
      ['A', 'B', 'Home'],
    );
    assert.equal(fake.db().binders.find((b) => b.id === a.id)?.name, 'A');
  });

  it('a write rejected before it started is never applied later (rejected means nothing was written)', { timeout: HANG_MS }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const fake = fifoIo(seeded());
    const repo = createRepository(fake.io);
    const release = fake.holdNextRead();
    const late = repo.renameBinder('b1', 'Late');
    void late.catch(() => undefined);
    await settle();
    t.mock.timers.tick(15000);
    const err = await late.then(
      () => null,
      (e: unknown) => e,
    );
    assert.ok(err instanceof SerialTimeoutError);
    assert.equal(err.pendingWrite, null);
    release(); // the read comes back after the caller was told it failed
    await settle();
    assert.equal(fake.db().binders.find((b) => b.id === 'b1')?.name, 'Home');
  });

  it('a task whose read hung past 15 s is rejected and never writes its stale snapshot', { timeout: HANG_MS }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const fake = fifoIo(seeded());
    const repo = createRepository(fake.io);
    const release = fake.holdNextRead();
    const late = repo.renameBinder('b1', 'Late');
    void late.catch(() => undefined);
    await settle();
    t.mock.timers.tick(15000);
    await assert.rejects(late, SerialTimeoutError);
    const next = repo.renameBinder('b1', 'Next');
    await settle();
    release();
    await next;
    await settle();
    assert.equal(fake.db().binders.find((b) => b.id === 'b1')?.name, 'Next');
  });
});

/**
 * Hold the next storage write, start `run`, and pass the 15 s queue limit while that write
 * is still in flight. `state()` tells whether the caller has been answered yet.
 */
async function pastLimitWithWriteInFlight<T>(
  t: TestContext,
  fake: ReturnType<typeof fifoIo>,
  run: () => Promise<T>,
) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const release = fake.holdNextWrite();
  let state = 'pending';
  const running = run();
  void running.then(
    () => {
      state = 'resolved';
    },
    () => {
      state = 'rejected';
    },
  );
  await settle();
  t.mock.timers.tick(15000);
  await settle();
  return { running, release, state: () => state };
}

describe('a non-seal write that outlives the queue limit reports what was persisted (no failure toast for a write that lands)', () => {
  const writes: {
    name: string;
    run: (repo: ReturnType<typeof createRepository>) => Promise<unknown>;
    applied: (db: DbSnapshot) => boolean;
  }[] = [
    {
      name: 'updateSettings',
      run: (r) => r.updateSettings({ showLocation: true }),
      applied: (db) => db.settings.showLocation === true,
    },
    {
      name: 'createBinder',
      run: (r) => r.createBinder('First'),
      applied: (db) => db.binders.some((b) => b.name === 'First'),
    },
    {
      name: 'renameBinder',
      run: (r) => r.renameBinder('b1', 'Renamed'),
      applied: (db) => db.binders.find((b) => b.id === 'b1')?.name === 'Renamed',
    },
    {
      name: 'deleteBinder',
      run: (r) => r.deleteBinder('b1'),
      applied: (db) =>
        !db.binders.some((b) => b.id === 'b1') &&
        db.cards.find((c) => c.id === 'c1')?.binderId === null,
    },
    {
      name: 'moveCard',
      run: (r) => r.moveCard('c1', null),
      applied: (db) => db.cards.find((c) => c.id === 'c1')?.binderId === null,
    },
    {
      name: 'destroyCard',
      run: (r) => r.destroyCard('c1'),
      applied: (db) => !db.cards.some((c) => c.id === 'c1'),
    },
  ];

  for (const w of writes) {
    it(`${w.name}: not reported failed while its write is in flight past 15 s; resolves once the write lands`, { timeout: HANG_MS }, async (t) => {
      const fake = fifoIo(seeded());
      const repo = createRepository(fake.io);
      const stuck = await pastLimitWithWriteInFlight(t, fake, () => w.run(repo));
      assert.equal(stuck.state(), 'pending', `${w.name} answered before its write settled`);
      stuck.release();
      await stuck.running;
      assert.ok(w.applied(fake.db()), `${w.name} was not stored: ${JSON.stringify(fake.db())}`);
    });
  }

  it('createBinder: a late landing returns the stored binder, so the user has nothing to retry (one binder, same id)', { timeout: HANG_MS }, async (t) => {
    const fake = fifoIo(seeded());
    const repo = createRepository(fake.io);
    const stuck = await pastLimitWithWriteInFlight(t, fake, () => repo.createBinder('Trip'));
    stuck.release();
    const b = await stuck.running;
    const trips = fake.db().binders.filter((x) => x.name === 'Trip');
    assert.deepEqual(
      trips.map((x) => x.id),
      [b.id],
    );
  });

  it('createBinder: a late write that fails rejects with its error and stores nothing', { timeout: HANG_MS }, async (t) => {
    const fake = fifoIo(seeded());
    const repo = createRepository(fake.io);
    const stuck = await pastLimitWithWriteInFlight(t, fake, () => repo.createBinder('Trip'));
    assert.equal(stuck.state(), 'pending');
    stuck.release(new Error('disk full'));
    await assert.rejects(stuck.running, /disk full/);
    assert.deepEqual(
      fake.db().binders.map((b) => b.name),
      ['Home'],
    );
  });

  it('destroyCard: a late landing also deletes the image (no orphan file)', { timeout: HANG_MS }, async (t) => {
    const fake = fifoIo(seeded());
    fake.files.add('file:///docs/sealcard/cards/c1.jpg');
    const repo = createRepository(fake.io);
    const stuck = await pastLimitWithWriteInFlight(t, fake, () => repo.destroyCard('c1'));
    stuck.release();
    await stuck.running;
    assert.deepEqual(fake.db().cards, []);
    assert.deepEqual([...fake.files], [], 'the row is gone, so its image must be gone too');
  });

  it('destroyCard: a late write that fails rejects and keeps both the row and the image', { timeout: HANG_MS }, async (t) => {
    const fake = fifoIo(seeded());
    fake.files.add('file:///docs/sealcard/cards/c1.jpg');
    const repo = createRepository(fake.io);
    const stuck = await pastLimitWithWriteInFlight(t, fake, () => repo.destroyCard('c1'));
    assert.equal(stuck.state(), 'pending');
    stuck.release(new Error('disk full'));
    await assert.rejects(stuck.running, /disk full/);
    assert.deepEqual(
      fake.db().cards.map((c) => c.id),
      ['c1'],
    );
    assert.deepEqual([...fake.files], ['file:///docs/sealcard/cards/c1.jpg']);
  });
});

describe('late seal toast against real storage order (binder deleted while the seal write was stuck)', () => {
  it('the toast says Uncategorized when the user deleted the binder before the late write landed', { timeout: HANG_MS }, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const fake = fifoIo(seeded());
    const repo = createRepository(fake.io);
    const release = fake.holdNextWrite();
    const sealing = repo.sealCard(input('b1')); // row placed in b1, its write stuck
    await settle();
    t.mock.timers.tick(15000); // queue moves on; the user left the picker
    await settle();
    const deleting = repo.deleteBinder('b1'); // ...and deleted that binder; storage serves it after the stuck write
    await settle();

    const toasts: string[] = [];
    let announced: Promise<void> = Promise.resolve();
    const hooks = pickerSealHooks({
      phase: () => {},
      done: () => {},
      failed: () => {},
      late: (outcome) => {
        announced = announceLateSeal(outcome, {
          getBinderName: repo.binderNameAfterWrites, // what App.tsx binds
          toast: (m) => toasts.push(m),
          t: (key, options) => (options ? `${key} ${JSON.stringify(options)}` : key),
          refresh: () => {},
        });
      },
    });
    release();
    hooks.late?.({ ok: true, result: await sealing });
    await announced;
    await deleting;

    const c = fake.db().cards.find((x) => x.id !== 'c1');
    assert.equal(c?.binderId, null, 'the card ended up unsorted');
    assert.deepEqual(toasts, ['pickBinder.lateSealedUnsortedToast']);
  });
});
