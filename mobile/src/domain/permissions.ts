export type PermissionSnapshot = { granted: boolean; canAskAgain: boolean };
/** Snapshot with the expo status ('granted' | 'denied' | 'undetermined'). */
export type PermissionState = PermissionSnapshot & { status: string };
export type PermissionAction = 'none' | 'request' | 'openSettings';

/**
 * What the "allow" button should do.
 *
 * `canAskAgain=false` alone is not proof of a permanent denial: expo-modules-core
 * (PermissionsService.kt `withBlockedTracking`) flags any denied result without a
 * rationale as blocked and persists it, and Android reports a dismissed first
 * dialog (back / tap outside) exactly that way. So the button only switches to
 * the app settings page once a press confirmed the block (`blockedConfirmed`,
 * see classifyPermissionRequest); otherwise it keeps asking the system dialog.
 */
export function permissionAction(
  p: PermissionSnapshot | null,
  blockedConfirmed = false,
): PermissionAction {
  if (!p || p.granted) return 'none';
  return !p.canAskAgain && blockedConfirmed ? 'openSettings' : 'request';
}

export type PermissionRequestOutcome =
  /** Allowed. */
  | 'granted'
  /** Not permanent (explicit first denial, or a dismissed dialog): keep asking. */
  | 'askAgain'
  /** Denied again after a shown prompt with rationale: show "open settings". */
  | 'blocked'
  /** The system had no prompt to show: open settings in this same press. */
  | 'blockedNoPrompt';

/**
 * Classify a button-initiated request from the state before and after it.
 * Android never blocks on the first prompt (6–10 have no "don't ask again" box
 * there, 11+ need two denials), so `canAskAgain=false` after a request that
 * started undetermined is a dismissed dialog. Starting from a denial with
 * rationale, the prompt was shown and the user denied again → permanent.
 * Starting from an already-flagged block, the system answered without a prompt
 * (or the user dismissed a re-shown prompt) → settings is the only working path.
 */
export function classifyPermissionRequest(
  before: PermissionState,
  after: PermissionState,
): PermissionRequestOutcome {
  if (after.granted) return 'granted';
  if (after.canAskAgain) return 'askAgain';
  if (before.status !== 'denied') return 'askAgain';
  return before.canAskAgain ? 'blocked' : 'blockedNoPrompt';
}

/**
 * A request the system answers without UI (permission already blocked) comes
 * back in a few hundred ms; answering a shown dialog takes a human longer.
 */
export const NO_PROMPT_MAX_MS = 1000;

/**
 * Open the settings page in the same press only when the system evidently showed
 * no dialog. A slow no-prompt answer just leaves the button on "open settings"
 * (one more tap, never a no-op); a dismissed re-shown dialog is not pushed into settings.
 */
export function openSettingsNow(outcome: PermissionRequestOutcome, elapsedMs: number): boolean {
  return outcome === 'blockedNoPrompt' && elapsedMs < NO_PROMPT_MAX_MS;
}
