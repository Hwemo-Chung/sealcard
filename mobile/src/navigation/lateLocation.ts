import type { RootScreen } from './types';

/**
 * Apply a place lookup that finished after the camera's post-shutter wait.
 * Only the preview of the same shot (photoUri) without a place is updated: once
 * the user confirms, the stamped composite is captured ("sealed as seen"), so the
 * binder picker and any later screen are left alone. Returns `screen` itself when
 * nothing changes, so a React state update bails out.
 */
export function applyLateLocation(
  screen: RootScreen,
  photoUri: string,
  label: string | null,
): RootScreen {
  if (label == null) return screen;
  if (screen.name !== 'sealPreview') return screen;
  if (screen.photoUri !== photoUri || screen.locationLabel != null) return screen;
  return { ...screen, locationLabel: label };
}

export type CapturedPlace = {
  photoUri: string;
  /** Label stamped at the shutter (fresh or recent position), null if none. */
  locationLabel: string | null;
  /** Lookup still running when the shutter wait ran out, else null. */
  locationPending: Promise<string | null> | null;
};

/**
 * App wiring for SealCameraScreen.onCaptured: when the shutter stamped no place,
 * apply the running lookup's result to the preview once it lands. A place the
 * shutter already stamped (e.g. the recent position) is never replaced — the
 * user has seen it, and confirming captures the composite as seen.
 */
export function stampLateLocation(
  capture: CapturedPlace,
  update: (next: (prev: RootScreen) => RootScreen) => void,
): void {
  if (capture.locationLabel != null || !capture.locationPending) return;
  // PlaceLookup promises never reject by contract; a broken lookup still must not
  // surface as an unhandled rejection (the preview just keeps no place).
  void capture.locationPending.then(
    (label) => update((prev) => applyLateLocation(prev, capture.photoUri, label)),
    () => undefined,
  );
}

export type ConfirmedComposite = {
  /** Photo of the preview the composite was captured from. */
  photoUri: string;
  compositeUri: string;
  width: number;
  height: number;
};

/**
 * App onConfirmSeal (used as a state updater): build the binder picker from the
 * latest preview, so a place that landed while the confirm dialog was open is
 * carried over. Unchanged when back already left the preview, or when the
 * composite belongs to another shot (a capture that finished after a retake).
 */
export function confirmPreview(prev: RootScreen, shot: ConfirmedComposite): RootScreen {
  if (prev.name !== 'sealPreview' || prev.photoUri !== shot.photoUri) return prev;
  return {
    name: 'pickBinder',
    photoUri: prev.photoUri,
    templateId: prev.templateId,
    dateFormatId: prev.dateFormatId,
    sealedAtIso: prev.sealedAtIso,
    compositeUri: shot.compositeUri,
    width: shot.width,
    height: shot.height,
    showDate: prev.showDate,
    locationLabel: prev.locationLabel,
    showBinderName: prev.showBinderName,
  };
}
