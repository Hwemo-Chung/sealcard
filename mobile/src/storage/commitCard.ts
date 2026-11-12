import { isPendingWriteTimeout, type Lease } from './serialQueue';

export type CommitIo<C, Db extends { cards: C[] }> = {
  /** Copy the composite into app storage. */
  copy: () => Promise<unknown>;
  /** Fresh db snapshot (repository.readDb parses storage on every call). */
  read: () => Promise<Db>;
  write: (db: Db) => Promise<void>;
  /** Remove the copied (possibly partial) file after a failed step. */
  discard: () => Promise<unknown>;
  /**
   * The row to store, decided against the snapshot read inside the exclusive
   * section (e.g. its binder was deleted meanwhile → unsorted). Omitted = `card`.
   */
  place?: (db: Db, card: C) => C;
  /**
   * Runs the read→push→write step exclusively (the repository's write queue), so
   * no other db write can interleave with it. The lease fences the write once the
   * queue gave up on the step. Omitted = run directly.
   */
  exclusive?: <T>(task: (lease?: Lease) => Promise<T>) => Promise<T>;
};

/**
 * Persist a sealed card: copy the file, then read-modify-write the db. The
 * snapshot is read after the copy, so a slow copy (a save that outlived the
 * picker's watchdog while the user went on creating binders or cards) cannot
 * write back rows from before those changes. The copy stays outside the
 * exclusive section, so a hung copy never blocks other writes. If any step fails
 * (including the copy, which may leave a partial file), the file is removed —
 * except when the queue timed out after the write was handed to storage: then the
 * outcome is unknown, so this waits for that write and keeps the file if the row
 * landed (a row must never point at a deleted image). Resolves with the stored row.
 */
export async function commitCard<C, Db extends { cards: C[] }>(
  io: CommitIo<C, Db>,
  card: C,
): Promise<C> {
  const exclusive = io.exclusive ?? (<T>(task: (lease?: Lease) => Promise<T>) => task());
  let row = card;
  try {
    await io.copy();
    await exclusive(async (lease) => {
      const db = await io.read();
      row = io.place ? io.place(db, card) : card;
      db.cards.push(row);
      await (lease ? lease.write(() => io.write(db)) : io.write(db));
    });
    return row;
  } catch (e) {
    if (isPendingWriteTimeout(e)) {
      const landed = await e.pendingWrite.then(
        () => true,
        () => false,
      );
      if (landed) return row;
    }
    await io.discard().catch(() => undefined);
    throw e;
  }
}
