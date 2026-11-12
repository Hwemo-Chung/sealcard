/**
 * Open an external URL (mailto:, https:) and run `onFail` when no app can
 * handle it — otherwise the tap silently does nothing.
 */
export async function openOrFallback(
  open: (url: string) => Promise<unknown>,
  url: string,
  onFail: () => void,
): Promise<boolean> {
  try {
    await open(url);
    return true;
  } catch {
    onFail();
    return false;
  }
}
