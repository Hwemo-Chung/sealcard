import { guard } from '../domain/guard';
import {
  placeAtShutter,
  type PlaceLookup,
  type PlaceTracker,
  type ShutterPlace,
} from '../domain/placeLookup';

/**
 * SealCameraScreen's AppState listener. Back in the foreground (system settings,
 * another app, screen unlock): re-read the camera permission and restart the place
 * lookup, which may be an hour old. The restart never shows the location dialog
 * (PlaceTracker.onForeground; Android also reports 'active' when a dialog closes).
 */
export function onCameraAppState(
  state: string,
  fx: {
    recheckPermission: () => Promise<unknown>;
    tracker: Pick<PlaceTracker, 'onForeground'>;
    follow: (lookup: PlaceLookup) => void;
  },
): void {
  if (state !== 'active') return;
  void guard(fx.recheckPermission);
  const next = fx.tracker.onForeground();
  if (next) fx.follow(next);
}

/**
 * The shutter's place step: a lookup older than PLACE_MAX_AGE_MS is restarted and
 * shown (`follow`) and its shown place dropped; the location toggle is re-read
 * after the wait (`isOn` must be a getter, so turning it off mid-wait stamps nothing).
 */
export function placeForShot({
  tracker,
  shown,
  isOn,
  follow,
}: {
  tracker: Pick<PlaceTracker, 'atShutter'>;
  shown: string | null;
  isOn: () => boolean;
  follow: (lookup: PlaceLookup) => void;
}): Promise<ShutterPlace> {
  const shutter = tracker.atShutter(shown);
  if (shutter.restarted && shutter.lookup) follow(shutter.lookup);
  return placeAtShutter({ enabled: isOn, resolved: shutter.resolved, lookup: shutter.lookup });
}
