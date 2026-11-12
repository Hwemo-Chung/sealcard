import type { SealPhase } from '../domain/sealSave';
import type { RootScreen } from './types';

export type BackAction =
  | { type: 'exit' }
  /** Handled: do nothing (e.g. a seal is being saved). */
  | { type: 'consume' }
  | { type: 'navigate'; to: RootScreen; reloadSettings: boolean };

export type BackContext = {
  /** PickBinderScreen is saving the seal; its onDone will navigate. */
  busy?: boolean;
  /**
   * The picker's save outlived its watchdog (domain/sealSave). It may still land,
   * so back leaves to the binder list like Cancel instead of the preview.
   */
  stalled?: boolean;
};

const go = (to: RootScreen, reloadSettings = false): BackAction => ({
  type: 'navigate',
  to,
  reloadSettings,
});

/**
 * Android hardware/gesture back for the App.tsx state machine.
 * `exit` = let the OS handle it (root screen). Settings must reload persisted
 * settings on the way out, exactly like its on-screen back button.
 * While the binder picker is saving, back is consumed: leaving would let the
 * pending onDone overwrite the new screen, and re-confirming the preview could
 * seal the same capture twice. After the save stalls, back leaves like Cancel.
 */
export function resolveBack(
  screen: RootScreen,
  { busy = false, stalled = false }: BackContext = {},
): BackAction {
  if (busy && screen.name === 'pickBinder') return { type: 'consume' };
  // Not the preview: re-confirming the same capture would mount a new picker whose
  // Done could seal it a second time while the stalled save may still complete.
  if (stalled && screen.name === 'pickBinder') return go({ name: 'binders' });
  switch (screen.name) {
    case 'binders':
      return { type: 'exit' };
    case 'binderDetail':
      return go({ name: 'binders' });
    case 'cardDetail':
      return go({ name: 'binderDetail', binderId: screen.fromBinderId ?? null });
    case 'sealCamera':
      return go({ name: 'binders' });
    case 'sealPreview':
      return go({ name: 'sealCamera' });
    case 'pickBinder':
      return go({
        name: 'sealPreview',
        photoUri: screen.photoUri,
        templateId: screen.templateId,
        dateFormatId: screen.dateFormatId,
        sealedAtIso: screen.sealedAtIso,
        showDate: screen.showDate,
        locationLabel: screen.locationLabel,
        showBinderName: screen.showBinderName,
      });
    case 'settings':
      return go({ name: 'binders' }, true);
  }
}

export type BackEffects = {
  navigate: (to: RootScreen) => void;
  reloadSettings: () => void;
};

/**
 * Body of App's `hardwareBackPress` listener, given the binder picker's save
 * phase. Returns the BackHandler contract value: true = handled, false = let the
 * OS handle it (exit from the root list).
 */
export function onHardwareBack(screen: RootScreen, phase: SealPhase, fx: BackEffects): boolean {
  const action = resolveBack(screen, {
    busy: phase === 'saving',
    stalled: phase === 'stalled',
  });
  if (action.type === 'exit') return false;
  if (action.type === 'consume') return true;
  if (action.reloadSettings) fx.reloadSettings();
  fx.navigate(action.to);
  return true;
}
