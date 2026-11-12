export type SealNoticeFx = {
  /**
   * null: no binder with that id (it was deleted). Must see every write queued before
   * the call (App binds repository binderNameAfterWrites), or a delete still waiting
   * behind a late seal's write is missed.
   */
  getBinderName: (binderId: string) => Promise<string | null>;
  toast: (message: string) => void;
  t: (key: string, options?: Record<string, string | number>) => string;
};

/**
 * A seal that settled after its binder picker was left (domain/sealSave `late`).
 * binderId null: the chosen binder was deleted meanwhile, so the card was stored
 * unsorted (repository sealCard).
 */
export type LateSealOutcome =
  | { ok: true; cardId: string; binderId: string | null }
  | { ok: false };

/** named · gone (no such binder any more) · unknown (the lookup failed; it may exist). */
type BinderLookup = { kind: 'named'; name: string } | { kind: 'gone' } | { kind: 'unknown' };

async function lookupBinder(binderId: string, fx: SealNoticeFx): Promise<BinderLookup> {
  // Also covers a lookup that throws before returning a promise.
  return Promise.resolve()
    .then(() => fx.getBinderName(binderId))
    .then(
      (name): BinderLookup => (name == null ? { kind: 'gone' } : { kind: 'named', name }),
      (): BinderLookup => ({ kind: 'unknown' }),
    );
}

function titleOf(found: BinderLookup, fx: SealNoticeFx): string {
  return found.kind === 'named' ? found.name : fx.t('binderDetail.fallbackTitle');
}

/**
 * Toast after a seal; a failing binder lookup falls back to the generic title.
 * binderId null (binder deleted meanwhile) says the card went to Uncategorized.
 * Never rejects.
 */
export async function announceSealed(binderId: string | null, fx: SealNoticeFx): Promise<void> {
  if (binderId === null) {
    fx.toast(fx.t('pickBinder.sealedUnsortedToast'));
    return;
  }
  fx.toast(fx.t('pickBinder.sealedToast', { name: titleOf(await lookupBinder(binderId, fx), fx) }));
}

/**
 * App-level report of a late seal: a success refreshes the binder list (the card
 * is already stored) and names the binder; a failure says nothing was saved.
 * Where the card is decided now, not from the stored row alone: a seal whose write
 * timed out and landed late still names its binder in the row, but the user may have
 * deleted that binder meanwhile (that delete lands after the seal's write), and
 * deleteBinder moves the card to Uncategorized. So a binder that no longer exists, as
 * seen by a lookup queued after that delete (`getBinderName`), means Uncategorized. A
 * failed lookup keeps the generic title. Never rejects.
 */
export async function announceLateSeal(
  outcome: LateSealOutcome,
  fx: SealNoticeFx & { refresh: () => void },
): Promise<void> {
  if (!outcome.ok) {
    fx.toast(fx.t('pickBinder.lateFailedToast'));
    return;
  }
  fx.refresh();
  const found = outcome.binderId === null ? null : await lookupBinder(outcome.binderId, fx);
  if (found === null || found.kind === 'gone') {
    fx.toast(fx.t('pickBinder.lateSealedUnsortedToast'));
    return;
  }
  fx.toast(fx.t('pickBinder.lateSealedToast', { name: titleOf(found, fx) }));
}
