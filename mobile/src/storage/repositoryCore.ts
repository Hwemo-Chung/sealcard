import { createId } from '../domain/id';
import { commitCard } from './commitCard';
import { createSerialQueue, isPendingWriteTimeout, type Lease } from './serialQueue';
import {
  DEFAULT_SETTINGS,
  type Binder,
  type BinderId,
  type Card,
  type CardId,
  type DbSnapshot,
  type Settings,
  type TemplateId,
  type DateFormatId,
} from '../domain/types';

export const DB_KEY = 'sealcard/db/v1';

/**
 * Storage and file calls, injected so the read-modify-write logic is testable
 * without React Native (repository.ts binds AsyncStorage and expo-file-system).
 */
export type RepositoryIo = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  /** expo-file-system documentDirectory (null when unavailable). */
  documentDirectory: () => string | null;
  exists: (uri: string) => Promise<boolean>;
  /** Creates intermediate directories. */
  makeDirectory: (uri: string) => Promise<void>;
  copy: (from: string, to: string) => Promise<void>;
  /** Idempotent delete. */
  remove: (uri: string) => Promise<void>;
};

export interface SealInput {
  binderId: BinderId;
  templateId: TemplateId;
  dateFormatId: DateFormatId;
  /** temp uri of captured composite jpeg */
  compositeUri: string;
  width: number;
  height: number;
  sealedAt: string;
}

function emptyDb(): DbSnapshot {
  return {
    version: 1,
    binders: [],
    cards: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function createRepository(io: RepositoryIo) {
  /**
   * Every db read-modify-write runs through this one queue (in-process mutex), so
   * concurrent writers can't drop each other's binder or card rows. Reads and
   * file copies stay outside it.
   */
  const serial = createSerialQueue();

  /**
   * A db read-modify-write whose caller learns what was actually persisted. When the
   * queue gives up after the task handed its write to storage (SerialTimeoutError with
   * `pendingWrite`), the outcome is unknown, so this waits for the task itself: it
   * settles when that write does (the write is each task's last step). Landed → the
   * task's result, as if on time; failed → the write's error. A non-seal write is thus
   * never reported failed and then persisted (a retried createBinder made a duplicate;
   * destroyCard left the image of a row that was deleted). The queue still moves on
   * meanwhile (the wait is outside it). A task fenced before its write still rejects at
   * once: nothing was or will be written. Same rule as commitCard for seals.
   */
  function write<T>(task: (lease: Lease) => Promise<T>): Promise<T> {
    let running: Promise<T> | null = null;
    return serial((lease) => {
      running = task(lease);
      return running;
    }).catch((e: unknown) => {
      if (isPendingWriteTimeout(e) && running) return running;
      throw e;
    });
  }

  async function readDb(): Promise<DbSnapshot> {
    const raw = await io.getItem(DB_KEY);
    if (!raw) return emptyDb();
    try {
      const parsed = JSON.parse(raw) as DbSnapshot;
      if (parsed.version !== 1) return emptyDb();
      return {
        version: 1,
        binders: parsed.binders ?? [],
        cards: parsed.cards ?? [],
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      };
    } catch {
      return emptyDb();
    }
  }

  /** Only inside a queue task: the lease refuses the write once the task timed out. */
  async function writeDb(db: DbSnapshot, lease: Lease): Promise<void> {
    await lease.write(() => io.setItem(DB_KEY, JSON.stringify(db)));
  }

  async function getCardsDir(): Promise<string> {
    const base = io.documentDirectory();
    if (!base) throw new Error('documentDirectory unavailable');
    const dir = `${base}sealcard/cards/`;
    if (!(await io.exists(dir))) {
      await io.makeDirectory(dir);
    }
    return dir;
  }

  async function loadSnapshot(): Promise<DbSnapshot> {
    return readDb();
  }

  async function getSettings(): Promise<Settings> {
    const db = await readDb();
    return db.settings;
  }

  function updateSettings(patch: Partial<Settings>): Promise<Settings> {
    return write(async (lease) => {
      const db = await readDb();
      db.settings = { ...db.settings, ...patch };
      await writeDb(db, lease);
      return db.settings;
    });
  }

  async function listBinders(): Promise<Binder[]> {
    const db = await readDb();
    return [...db.binders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /** Caller must pass a non-empty name (e.g. t('pickBinder.defaultName') when field empty). */
  function createBinder(name: string): Promise<Binder> {
    const trimmed = name.trim();
    const finalName = trimmed.length > 0 ? trimmed : name;
    return write(async (lease) => {
      const db = await readDb();
      const binder: Binder = {
        id: createId('b'),
        name: finalName,
        createdAt: new Date().toISOString(),
      };
      db.binders.push(binder);
      await writeDb(db, lease);
      return binder;
    });
  }

  function renameBinder(id: BinderId, name: string): Promise<void> {
    return write(async (lease) => {
      const db = await readDb();
      const b = db.binders.find((x) => x.id === id);
      if (!b) return;
      b.name = name.trim() || b.name;
      await writeDb(db, lease);
    });
  }

  /** Delete binder only; cards move to uncategorized (binderId = null). */
  function deleteBinder(id: BinderId): Promise<void> {
    return write(async (lease) => {
      const db = await readDb();
      db.binders = db.binders.filter((b) => b.id !== id);
      for (const c of db.cards) {
        if (c.binderId === id) c.binderId = null;
      }
      await writeDb(db, lease);
    });
  }

  async function listCards(binderId?: BinderId | null): Promise<Card[]> {
    const db = await readDb();
    let cards = db.cards;
    if (binderId === null) {
      cards = cards.filter((c) => c.binderId === null);
    } else if (binderId !== undefined) {
      cards = cards.filter((c) => c.binderId === binderId);
    }
    return [...cards].sort(
      (a, b) => new Date(b.sealedAt).getTime() - new Date(a.sealedAt).getTime(),
    );
  }

  async function getCard(id: CardId): Promise<Card | null> {
    const db = await readDb();
    return db.cards.find((c) => c.id === id) ?? null;
  }

  async function getBinder(id: BinderId): Promise<Binder | null> {
    const db = await readDb();
    return db.binders.find((b) => b.id === id) ?? null;
  }

  /**
   * Binder name read through the write queue, so every write queued before this call
   * has finished first (null: no such binder). The seal toasts use it: a seal whose
   * write timed out lands late, and a deleteBinder the user started meanwhile sits
   * behind that write in storage. A plain read would still see the binder and name it,
   * though the delete then moves the card to Uncategorized. If the queue is stuck this
   * rejects after the queue limit (the toast then uses the generic title).
   */
  function binderNameAfterWrites(id: BinderId): Promise<string | null> {
    return serial(async () => {
      const db = await readDb();
      return db.binders.find((b) => b.id === id)?.name ?? null;
    });
  }

  async function countCardsInBinder(binderId: BinderId | null): Promise<number> {
    const db = await readDb();
    return db.cards.filter((c) => c.binderId === binderId).length;
  }

  async function latestThumbInBinder(binderId: BinderId | null): Promise<string | null> {
    const cards = await listCards(binderId);
    return cards[0]?.imagePath ?? null;
  }

  /**
   * Seal a card: persist composite file + immutable row.
   * No update path for image/template/date exists by design.
   * On DB failure after file write, deletes partial file (rollback).
   * The db snapshot is read after the copy (see commitCard). If the chosen binder
   * was deleted meanwhile (a stalled save the user walked away from), the card is
   * stored unsorted (binderId null) so it stays reachable; the returned row says
   * where it went.
   */
  async function sealCard(input: SealInput): Promise<Card> {
    const id = createId('c');
    const dir = await getCardsDir();
    const dest = `${dir}${id}.jpg`;

    const card: Card = {
      id,
      binderId: input.binderId,
      sealedAt: input.sealedAt,
      templateId: input.templateId,
      dateFormatId: input.dateFormatId,
      imagePath: dest,
      width: input.width,
      height: input.height,
    };

    return commitCard(
      {
        copy: () => io.copy(input.compositeUri, dest),
        read: readDb,
        write: (db) => io.setItem(DB_KEY, JSON.stringify(db)),
        discard: () => io.remove(dest),
        place: (db, row) =>
          db.binders.some((b) => b.id === row.binderId) ? row : { ...row, binderId: null },
        exclusive: serial,
      },
      card,
    );
  }

  function moveCard(cardId: CardId, binderId: BinderId | null): Promise<void> {
    return write(async (lease) => {
      const db = await readDb();
      const c = db.cards.find((x) => x.id === cardId);
      if (!c) return;
      c.binderId = binderId;
      await writeDb(db, lease);
    });
  }

  /**
   * Destroy card permanently — no undo. Clears widget pointer if needed. The image is
   * removed only after the row's deletion is known to have landed (`write`).
   */
  async function destroyCard(cardId: CardId): Promise<void> {
    const c = await write(async (lease) => {
      const db = await readDb();
      const found = db.cards.find((x) => x.id === cardId);
      if (!found) return null;
      db.cards = db.cards.filter((x) => x.id !== cardId);
      if (db.settings.widgetCardId === cardId) {
        db.settings.widgetCardId = null;
      }
      await writeDb(db, lease);
      return found;
    });
    if (!c) return;
    // The file is removed outside the queue (no db access).
    try {
      if (await io.exists(c.imagePath)) await io.remove(c.imagePath);
    } catch {
      // file may already be gone
    }
  }

  /** Card for home widget (P3). Fixed card or latest in binder. */
  async function resolveWidgetCard(): Promise<Card | null> {
    const db = await readDb();
    const { widgetCardId, widgetBinderId } = db.settings;
    if (widgetCardId) {
      return db.cards.find((c) => c.id === widgetCardId) ?? null;
    }
    if (widgetBinderId == null) return null;
    const cards = db.cards
      .filter((c) => c.binderId === widgetBinderId)
      .sort((a, b) => new Date(b.sealedAt).getTime() - new Date(a.sealedAt).getTime());
    return cards[0] ?? null;
  }

  return {
    getCardsDir,
    loadSnapshot,
    getSettings,
    updateSettings,
    listBinders,
    createBinder,
    renameBinder,
    deleteBinder,
    listCards,
    getCard,
    getBinder,
    binderNameAfterWrites,
    countCardsInBinder,
    latestThumbInBinder,
    sealCard,
    moveCard,
    destroyCard,
    resolveWidgetCard,
  };
}

export type Repository = ReturnType<typeof createRepository>;
