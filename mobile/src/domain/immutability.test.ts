/**
 * Lightweight invariant docs as executable checks (no jest runner required for tsc).
 * Run: npx tsc --noEmit
 *
 * Product law: Card has no update API for image/template/date after seal.
 * Repository exports prove only: sealCard, moveCard, destroyCard.
 */

import type { Card } from './types';

type MutableCardKeys = 'imagePath' | 'templateId' | 'dateFormatId' | 'sealedAt';

/** Compile-time reminder: UI must not expose editors for these fields. */
export type ForbiddenCardEdit = {
  [K in MutableCardKeys]?: never;
};

export function assertCardIdentityFrozen(
  before: Pick<Card, MutableCardKeys>,
  after: Pick<Card, MutableCardKeys>,
): void {
  if (before.imagePath !== after.imagePath) throw new Error('imagePath mutated');
  if (before.templateId !== after.templateId) throw new Error('templateId mutated');
  if (before.dateFormatId !== after.dateFormatId) throw new Error('dateFormatId mutated');
  if (before.sealedAt !== after.sealedAt) throw new Error('sealedAt mutated');
}
