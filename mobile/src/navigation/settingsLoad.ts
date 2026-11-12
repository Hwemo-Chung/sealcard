import { DEFAULT_SETTINGS, type Settings } from '../domain/types';

/** App start: the stored settings, or defaults when storage can't be read. Never rejects. */
export function bootSettings(read: () => Promise<Settings>): Promise<Settings> {
  return Promise.resolve()
    .then(read)
    .catch(() => ({ ...DEFAULT_SETTINGS }));
}

/** Re-read after Settings; on a read failure the settings in memory stay. Never rejects. */
export function refreshSettings(
  read: () => Promise<Settings>,
  apply: (settings: Settings) => void,
): Promise<void> {
  return Promise.resolve()
    .then(read)
    .then(apply, () => undefined);
}
