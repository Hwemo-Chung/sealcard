/**
 * Run a screen action whose promise nobody awaits (button handlers, focus
 * reloads). It starts now; a throw or rejection goes to `onError` (default:
 * ignored) instead of becoming an unhandled rejection. Never rejects.
 */
export function guard(task: () => unknown, onError: (e: unknown) => void = () => {}): Promise<void> {
  let running: Promise<unknown>;
  try {
    running = Promise.resolve(task());
  } catch (e) {
    running = Promise.reject(e);
  }
  return running.then(
    () => undefined,
    (e: unknown) => {
      try {
        onError(e);
      } catch {
        // the error report itself failed; nothing left to tell the user
      }
    },
  );
}
