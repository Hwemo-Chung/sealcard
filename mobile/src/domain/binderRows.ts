export type BinderRow = { id: string | null; name: string; count: number; thumb: string | null };

/** The repository reads the binder list uses (injected; this file must not import React Native). */
export type BinderRowsApi = {
  listBinders: () => Promise<{ id: string; name: string }[]>;
  countCardsInBinder: (binderId: string | null) => Promise<number>;
  latestThumbInBinder: (binderId: string | null) => Promise<string | null>;
};

/**
 * `rows` are the last rows read successfully (kept while reloading and after a
 * failed reload); `status` says whether the latest read is running, done or failed.
 */
export type RowsState = { status: 'loading' | 'ready' | 'error'; rows: BinderRow[] };

/** blank: first load running · error: read failed (retry + seal) · empty: no binders · list. */
export type BindersView = 'blank' | 'error' | 'empty' | 'list';

/** Binder rows (repository order: newest first), then Uncategorized when it has cards. */
export async function loadBinderRows(
  api: BinderRowsApi,
  uncategorized: string,
): Promise<BinderRow[]> {
  const binders = await api.listBinders();
  const rows: BinderRow[] = await Promise.all(
    binders.map(async (b) => ({
      id: b.id,
      name: b.name,
      count: await api.countCardsInBinder(b.id),
      thumb: await api.latestThumbInBinder(b.id),
    })),
  );
  const uncatCount = await api.countCardsInBinder(null);
  if (uncatCount > 0) {
    rows.push({
      id: null,
      name: uncategorized,
      count: uncatCount,
      thumb: await api.latestThumbInBinder(null),
    });
  }
  return rows;
}

/**
 * BindersScreen reload. Never rejects: a failed read ends in `error` (the screen
 * offers retry) instead of leaving the list loading forever. Only the latest
 * reload publishes, so a slow earlier read can't overwrite a newer one.
 */
export function createRowsLoader(
  load: () => Promise<BinderRow[]>,
  publish: (state: RowsState) => void,
): () => Promise<void> {
  let generation = 0;
  let rows: BinderRow[] = [];
  return async () => {
    generation += 1;
    const mine = generation;
    publish({ status: 'loading', rows });
    try {
      const next = await load();
      if (mine !== generation) return;
      rows = next;
      publish({ status: 'ready', rows });
    } catch {
      if (mine !== generation) return;
      publish({ status: 'error', rows });
    }
  };
}

export function bindersView(state: RowsState): BindersView {
  if (state.status === 'error') return 'error';
  if (state.rows.length > 0) return 'list';
  return state.status === 'loading' ? 'blank' : 'empty';
}
