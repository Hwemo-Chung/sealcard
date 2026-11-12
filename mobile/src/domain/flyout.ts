/** One move-target row: paddingVertical 11×2 + ~19dp line (14sp text). */
export const FLYOUT_ROW_HEIGHT = 41;
/** Flyout paddingVertical 6×2. */
export const FLYOUT_PADDING = 12;
/** Never let the move menu take more than this share of the window. */
export const FLYOUT_MAX_WINDOW_RATIO = 0.4;

export type FlyoutLayout = { contentHeight: number; maxHeight: number; scrollable: boolean };

/**
 * Card detail move menu height. The menu sits in normal layout flow above the
 * action pill, so an uncapped list pushes the pill off-screen with many binders.
 */
export function moveFlyoutLayout(optionCount: number, windowHeight: number): FlyoutLayout {
  const contentHeight = Math.max(0, optionCount) * FLYOUT_ROW_HEIGHT + FLYOUT_PADDING;
  const cap = Math.floor(windowHeight * FLYOUT_MAX_WINDOW_RATIO);
  // Cap by window only: row heights are estimates (font scale), so never clip a short list.
  return { contentHeight, maxHeight: cap, scrollable: contentHeight > cap };
}
