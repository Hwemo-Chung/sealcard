/**
 * Per-task limit. A task (one db read-modify-write) still running after this is
 * rejected with SerialTimeoutError and the queue moves on, so one stuck storage
 * call no longer blocks every later write until the app restarts.
 */
export const SERIAL_TASK_TIMEOUT_MS = 15000;

/**
 * A queued task outlived SERIAL_TASK_TIMEOUT_MS.
 *
 * `pendingWrite` null: the task had not started its write, and it never will
 * (Lease fence), so nothing was written.
 * `pendingWrite` set: the write was already handed to storage, so the outcome is
 * unknown. It may still land; await it to learn the result (every repository
 * write does: sealCard never deletes the image of a row that lands late, and the
 * other writes never report failure for a change that lands late).
 */
export class SerialTimeoutError extends Error {
  readonly pendingWrite: Promise<unknown> | null;
  constructor(pendingWrite: Promise<unknown> | null) {
    super('storage task timed out');
    this.name = 'SerialTimeoutError';
    this.pendingWrite = pendingWrite;
  }
}

/** True when `e` is a timeout whose write may still land (outcome unknown). */
export function isPendingWriteTimeout(
  e: unknown,
): e is SerialTimeoutError & { pendingWrite: Promise<unknown> } {
  return e instanceof SerialTimeoutError && e.pendingWrite != null;
}

export type Lease = {
  /**
   * Start this task's storage write. Once the task has timed out this rejects
   * with SerialTimeoutError instead of calling `op`: a task that resumes late
   * never writes back a snapshot older than what later tasks wrote.
   */
  write: <W>(op: () => Promise<W>) => Promise<W>;
};

export type Serial = <T>(task: (lease: Lease) => Promise<T>) => Promise<T>;

/** Call now; a synchronous throw becomes a rejection. */
function attempt<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return fn();
  } catch (e) {
    return Promise.reject(e);
  }
}

function runLimited<T>(task: (lease: Lease) => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let expired = false;
    let pendingWrite: Promise<unknown> | null = null;
    const lease: Lease = {
      write: (op) => {
        if (expired) return Promise.reject(new SerialTimeoutError(null));
        const started = attempt(op);
        pendingWrite = started;
        return started;
      },
    };
    const timer = setTimeout(() => {
      expired = true;
      reject(new SerialTimeoutError(pendingWrite));
    }, timeoutMs);
    // After a timeout the task's own result is dropped (handled, never unhandled).
    attempt(() => task(lease)).then(
      (value) => {
        clearTimeout(timer);
        if (!expired) resolve(value);
      },
      (e) => {
        clearTimeout(timer);
        if (!expired) reject(e);
      },
    );
  });
}

/**
 * Promise mutex: tasks run one at a time in call order. A rejected task rejects
 * only its own caller; later tasks still run. The repository wraps every
 * read-modify-write of the db in one queue, so concurrent writers (a stalled seal
 * finishing while the user creates a binder) can't overwrite each other's rows.
 *
 * Timeout (per task, from when it starts): the caller is rejected and the next
 * task starts. Why that cannot interleave writes unsafely:
 * - A task that times out before its write is fenced (Lease.write rejects), so a
 *   late read can never be written back over newer rows.
 * - A write already handed to storage cannot be recalled. AsyncStorage runs every
 *   get/set in submission order (Android: AsyncStorageModule's SerialExecutor), so
 *   the next task's read is served after that write lands or fails; it never
 *   reads around it. The error carries the write (`pendingWrite`) so the caller
 *   can wait for the real outcome.
 */
export function createSerialQueue(timeoutMs: number = SERIAL_TASK_TIMEOUT_MS): Serial {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: (lease: Lease) => Promise<T>): Promise<T> => {
    const run = tail.then(() => runLimited(task, timeoutMs));
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
