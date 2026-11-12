import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  NO_PROMPT_MAX_MS,
  classifyPermissionRequest,
  openSettingsNow,
  permissionAction,
} from './permissions';

describe('permissionAction (camera permission button)', () => {
  it('does nothing while the permission status is still loading', () => {
    assert.equal(permissionAction(null), 'none');
  });

  it('does nothing when already granted', () => {
    assert.equal(permissionAction({ granted: true, canAskAgain: true }), 'none');
  });

  it('asks the system dialog when the user can still be asked', () => {
    assert.equal(permissionAction({ granted: false, canAskAgain: true }), 'request');
  });

  it('opens app settings when the system will no longer show the dialog', () => {
    assert.equal(permissionAction({ granted: false, canAskAgain: false }, true), 'openSettings');
  });

  it('keeps asking when the system can prompt again, even after a confirmed block', () => {
    // e.g. permission reset in system settings while the button showed "open settings".
    assert.equal(permissionAction({ granted: false, canAskAgain: true }, true), 'request');
  });

  it('keeps asking when canAskAgain=false comes from a status read alone (dismissed prompt)', () => {
    assert.equal(permissionAction({ granted: false, canAskAgain: false }), 'request');
    assert.equal(permissionAction({ granted: false, canAskAgain: false }, false), 'request');
  });
});

describe('classifyPermissionRequest (result of pressing the allow button)', () => {
  const undetermined = { status: 'undetermined', granted: false, canAskAgain: true };
  const deniedOnce = { status: 'denied', granted: false, canAskAgain: true };
  const deniedNoRationale = { status: 'denied', granted: false, canAskAgain: false };
  const granted = { status: 'granted', granted: true, canAskAgain: true };

  it('reports a grant', () => {
    assert.equal(classifyPermissionRequest(undetermined, granted), 'granted');
    assert.equal(classifyPermissionRequest(deniedNoRationale, granted), 'granted');
  });

  it('does not treat a dismissed first prompt as a permanent denial', () => {
    // Android reports a dismissed first dialog as denied without rationale (canAskAgain=false).
    assert.equal(classifyPermissionRequest(undetermined, deniedNoRationale), 'askAgain');
  });

  it('keeps asking after a first explicit denial or a dismissed later prompt', () => {
    assert.equal(classifyPermissionRequest(undetermined, deniedOnce), 'askAgain');
    assert.equal(classifyPermissionRequest(deniedOnce, deniedOnce), 'askAgain');
  });

  it('treats a denial after a shown prompt with rationale as permanent', () => {
    assert.equal(classifyPermissionRequest(deniedOnce, deniedNoRationale), 'blocked');
  });

  it('sends a press the system answers without a prompt straight to settings', () => {
    assert.equal(classifyPermissionRequest(deniedNoRationale, deniedNoRationale), 'blockedNoPrompt');
  });

  it('never leaves the button as a silent no-op', () => {
    const states = [undetermined, deniedOnce, deniedNoRationale];
    for (const before of states) {
      for (const after of [...states, granted]) {
        const outcome = classifyPermissionRequest(before, after);
        const blocked = outcome === 'blocked' || outcome === 'blockedNoPrompt';
        const next = permissionAction(after, blocked);
        // Re-requesting a permission the system no longer prompts for does nothing visible.
        const silent =
          next === 'request' && !after.canAskAgain && before.status === 'denied' && !before.canAskAgain;
        assert.equal(silent, false, `${before.status}/${before.canAskAgain} -> ${after.status}/${after.canAskAgain}`);
      }
    }
  });
});

describe('openSettingsNow (auto-open settings in the same press)', () => {
  it('opens settings when a blocked request came back before anyone could answer a dialog', () => {
    assert.equal(openSettingsNow('blockedNoPrompt', 150), true);
  });

  it('does not push settings after a dialog that took human time (re-shown prompt dismissed)', () => {
    assert.equal(openSettingsNow('blockedNoPrompt', NO_PROMPT_MAX_MS), false);
    assert.equal(openSettingsNow('blockedNoPrompt', 2500), false);
  });

  it('never auto-opens for other outcomes', () => {
    for (const outcome of ['granted', 'askAgain', 'blocked'] as const) {
      assert.equal(openSettingsNow(outcome, 0), false, outcome);
    }
  });
});
