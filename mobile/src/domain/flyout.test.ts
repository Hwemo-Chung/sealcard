import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FLYOUT_PADDING, FLYOUT_ROW_HEIGHT, moveFlyoutLayout } from './flyout';

/**
 * Card detail chrome at 360x720dp with 3-button navigation (dp):
 * status bar 24 + nav bar 48 are outside the SafeAreaView.
 * header 28 + footer/pill 88 + flyout margin 10 stay fixed; the gallery is flex and may shrink to 0.
 */
const WINDOW_H = 720;
const AVAILABLE_H = WINDOW_H - 24 - 48;
const FIXED_CHROME = 28 + 88 + 10;

describe('moveFlyoutLayout (card detail move menu)', () => {
  it('shows a short list in full without scrolling', () => {
    const layout = moveFlyoutLayout(3, WINDOW_H);
    assert.equal(layout.contentHeight, 3 * FLYOUT_ROW_HEIGHT + FLYOUT_PADDING);
    assert.equal(layout.scrollable, false);
    assert.ok(layout.maxHeight >= layout.contentHeight);
  });

  it('caps a long list at 40% of the window and scrolls', () => {
    const layout = moveFlyoutLayout(13, WINDOW_H);
    assert.equal(layout.scrollable, true);
    assert.equal(layout.maxHeight, Math.floor(WINDOW_H * 0.4));
  });

  it('keeps the action bar on screen at 360x720 even with 50 binders', () => {
    const layout = moveFlyoutLayout(51, WINDOW_H);
    const used = FIXED_CHROME + Math.min(layout.contentHeight, layout.maxHeight);
    assert.ok(used <= AVAILABLE_H, `flyout pushes the pill off-screen: ${used} > ${AVAILABLE_H}`);
  });
});
