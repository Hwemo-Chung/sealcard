import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createKeyGate } from './reloadGate';

describe('createKeyGate (useReloadOnChange: reload on key changes after mount)', () => {
  it('skips the mount run and lets every later key change reload', () => {
    const changed = createKeyGate();
    assert.equal(changed(), false, 'mount: useFocusEffect already loads');
    assert.equal(changed(), true);
    assert.equal(changed(), true);
  });

  it('keeps a separate state per screen instance', () => {
    const a = createKeyGate();
    const b = createKeyGate();
    a();
    assert.equal(b(), false);
  });
});
