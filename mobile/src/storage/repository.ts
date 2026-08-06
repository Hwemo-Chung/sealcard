import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { createId } from '../domain/id';
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

const DB_KEY = 'sealcard/db/v1';

function emptyDb(): DbSnapshot {
  return {
    version: 1,
    binders: [],
    cards: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

async function readDb(): Promise<DbSnapshot> {
  const raw = await AsyncStorage.getItem(DB_KEY);
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

async function writeDb(db: DbSnapshot): Promise<void> {
  await AsyncStorage.setItem(DB_KEY, JSON.stringify(db));
}

export async function getCardsDir(): Promise<string> {
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('documentDirectory unavailable');
  const dir = `${base}sealcard/cards/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export async function loadSnapshot(): Promise<DbSnapshot> {
  return readDb();
}

export async function getSettings(): Promise<Settings> {
  const db = await readDb();
  return db.settings;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const db = await readDb();
  db.settings = { ...db.settings, ...patch };
  await writeDb(db);
  return db.settings;
}

export async function listBinders(): Promise<Binder[]> {
  const db = await readDb();
  return [...db.binders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function createBinder(name: string): Promise<Binder> {
  const trimmed = name.trim() || '나의 첫 시리즈';
  const db = await readDb();
  const binder: Binder = {
    id: createId('b'),
    name: trimmed,
    createdAt: new Date().toISOString(),
  };
  db.binders.push(binder);
  await writeDb(db);
  return binder;
}

export async function renameBinder(id: BinderId, name: string): Promise<void> {
  const db = await readDb();
  const b = db.binders.find((x) => x.id === id);
  if (!b) return;
  b.name = name.trim() || b.name;
  await writeDb(db);
}

/** Delete binder only; cards move to uncategorized (binderId = null). */
export async function deleteBinder(id: BinderId): Promise<void> {
  const db = await readDb();
  db.binders = db.binders.filter((b) => b.id !== id);
  for (const c of db.cards) {
    if (c.binderId === id) c.binderId = null;
  }
  await writeDb(db);
}

export async function listCards(binderId?: BinderId | null): Promise<Card[]> {
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

export async function getCard(id: CardId): Promise<Card | null> {
  const db = await readDb();
  return db.cards.find((c) => c.id === id) ?? null;
}

export async function getBinder(id: BinderId): Promise<Binder | null> {
  const db = await readDb();
  return db.binders.find((b) => b.id === id) ?? null;
}

export async function countCardsInBinder(binderId: BinderId | null): Promise<number> {
  const db = await readDb();
  return db.cards.filter((c) => c.binderId === binderId).length;
}

export async function latestThumbInBinder(
  binderId: BinderId | null,
): Promise<string | null> {
  const cards = await listCards(binderId);
  return cards[0]?.imagePath ?? null;
}

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

/**
 * Seal a card: persist composite file + immutable row.
 * No update path for image/template/date exists by design.
 * On DB failure after file write, deletes partial file (rollback).
 */
export async function sealCard(input: SealInput): Promise<Card> {
  const db = await readDb();
  const id = createId('c');
  const dir = await getCardsDir();
  const dest = `${dir}${id}.jpg`;

  await FileSystem.copyAsync({ from: input.compositeUri, to: dest });

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

  try {
    db.cards.push(card);
    await writeDb(db);
  } catch (e) {
    try {
      await FileSystem.deleteAsync(dest, { idempotent: true });
    } catch {
      // ignore cleanup errors
    }
    throw e;
  }
  return card;
}

export async function moveCard(cardId: CardId, binderId: BinderId | null): Promise<void> {
  const db = await readDb();
  const c = db.cards.find((x) => x.id === cardId);
  if (!c) return;
  c.binderId = binderId;
  await writeDb(db);
}

/** Destroy card permanently — no undo. Clears widget pointer if needed. */
export async function destroyCard(cardId: CardId): Promise<void> {
  const db = await readDb();
  const c = db.cards.find((x) => x.id === cardId);
  if (!c) return;
  db.cards = db.cards.filter((x) => x.id !== cardId);
  if (db.settings.widgetCardId === cardId) {
    db.settings.widgetCardId = null;
  }
  await writeDb(db);
  try {
    const info = await FileSystem.getInfoAsync(c.imagePath);
    if (info.exists) await FileSystem.deleteAsync(c.imagePath, { idempotent: true });
  } catch {
    // file may already be gone
  }
}

/** Card for home widget (P3). Fixed card or latest in binder. */
export async function resolveWidgetCard(): Promise<Card | null> {
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
