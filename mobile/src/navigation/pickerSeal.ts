import type { SealPhase, SealSaveHooks } from '../domain/sealSave';
import type { LateSealOutcome } from './sealNotice';

/** The row repository.sealCard stored (binderId null: its binder was deleted meanwhile). */
export type StoredCard = { id: string; binderId: string | null };

/** Every field is required, so the picker cannot drop a hook (e.g. `late`) without a type error. */
export type PickerSealFx = {
  phase: (phase: SealPhase) => void;
  /** Save finished while the picker is shown: open the binder the card was stored in. */
  done: (cardId: string, binderId: string | null) => void;
  failed: () => void;
  /** Save settled after the picker was left: App reports it (sealNotice). */
  late: (outcome: LateSealOutcome) => void;
};

/**
 * createSealSave hooks for the binder picker. The destination comes from the
 * stored row, not from the picker's selection: a late save whose binder was
 * deleted meanwhile is stored unsorted, and the toast/navigation must say so.
 */
export function pickerSealHooks(fx: PickerSealFx): SealSaveHooks<StoredCard> {
  return {
    phase: fx.phase,
    done: (card) => fx.done(card.id, card.binderId),
    failed: fx.failed,
    late: (outcome) =>
      fx.late(
        outcome.ok
          ? { ok: true, cardId: outcome.result.id, binderId: outcome.result.binderId }
          : { ok: false },
      ),
  };
}
