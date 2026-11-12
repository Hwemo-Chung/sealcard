import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createRepository } from './repositoryCore';
import { createRepositoryIo, type AsyncStorageLike, type FileSystemLike } from './repositoryIo';

/** AsyncStorage + expo-file-system/legacy stand-ins recording every call. */
function natives() {
  const calls: unknown[][] = [];
  const kv = new Map<string, string>();
  const files = new Set<string>();
  const storage: AsyncStorageLike = {
    getItem: async (key) => {
      calls.push(['getItem', key]);
      return kv.get(key) ?? null;
    },
    setItem: async (key, value) => {
      calls.push(['setItem', key]);
      kv.set(key, value);
    },
  };
  const fs: FileSystemLike = {
    documentDirectory: 'file:///data/user/0/app.sealcard.mobile/files/',
    getInfoAsync: async (uri) => {
      calls.push(['getInfoAsync', uri]);
      return { exists: files.has(uri) };
    },
    makeDirectoryAsync: async (uri, options) => {
      calls.push(['makeDirectoryAsync', uri, options]);
      files.add(uri);
    },
    copyAsync: async (options) => {
      calls.push(['copyAsync', options]);
      files.add(options.to);
    },
    deleteAsync: async (uri, options) => {
      calls.push(['deleteAsync', uri, options]);
      files.delete(uri);
    },
  };
  return { storage, fs, calls, kv, files };
}

describe('createRepositoryIo (repository.ts binding of AsyncStorage and expo-file-system)', () => {
  it('passes db keys and values to AsyncStorage unchanged', async () => {
    const n = natives();
    const io = createRepositoryIo(n.storage, n.fs);
    await io.setItem('sealcard/db/v1', '{"version":1}');
    assert.equal(await io.getItem('sealcard/db/v1'), '{"version":1}');
    assert.deepEqual(n.calls, [
      ['setItem', 'sealcard/db/v1'],
      ['getItem', 'sealcard/db/v1'],
    ]);
  });

  it('maps file calls: exists, intermediate directories, copy from→to, idempotent delete', async () => {
    const n = natives();
    const io = createRepositoryIo(n.storage, n.fs);
    assert.equal(await io.exists('file:///x.jpg'), false);
    await io.makeDirectory('file:///docs/sealcard/cards/');
    await io.copy('file:///cache/a.jpg', 'file:///docs/sealcard/cards/c1.jpg');
    assert.equal(await io.exists('file:///docs/sealcard/cards/c1.jpg'), true);
    await io.remove('file:///docs/sealcard/cards/c1.jpg');
    assert.deepEqual(n.calls, [
      ['getInfoAsync', 'file:///x.jpg'],
      ['makeDirectoryAsync', 'file:///docs/sealcard/cards/', { intermediates: true }],
      ['copyAsync', { from: 'file:///cache/a.jpg', to: 'file:///docs/sealcard/cards/c1.jpg' }],
      ['getInfoAsync', 'file:///docs/sealcard/cards/c1.jpg'],
      ['deleteAsync', 'file:///docs/sealcard/cards/c1.jpg', { idempotent: true }],
    ]);
    assert.equal(n.files.has('file:///docs/sealcard/cards/c1.jpg'), false);
  });

  it('reads documentDirectory when it is needed', () => {
    const n = natives();
    const io = createRepositoryIo(n.storage, n.fs);
    n.fs.documentDirectory = null;
    assert.equal(io.documentDirectory(), null);
  });

  it('end to end: a sealed then destroyed card leaves no file, and the db sits under sealcard/db/v1', async () => {
    const n = natives();
    const repo = createRepository(createRepositoryIo(n.storage, n.fs));
    const b = await repo.createBinder('Home');
    const c = await repo.sealCard({
      binderId: b.id,
      templateId: 'polaroid',
      dateFormatId: 'dot',
      compositeUri: 'file:///cache/a.jpg',
      width: 300,
      height: 380,
      sealedAt: '2026-11-12T00:00:00.000Z',
    });
    assert.equal(c.imagePath, `file:///data/user/0/app.sealcard.mobile/files/sealcard/cards/${c.id}.jpg`);
    assert.ok(n.files.has(c.imagePath));
    await repo.destroyCard(c.id);
    assert.equal(n.files.has(c.imagePath), false);
    assert.deepEqual([...n.kv.keys()], ['sealcard/db/v1']);
    assert.deepEqual(JSON.parse(n.kv.get('sealcard/db/v1') ?? 'null').cards, []);
  });
});
