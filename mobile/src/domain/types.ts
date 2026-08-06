/** Sealcard domain — sealed cards are immutable after create. */

export type TemplateId =
  | 'polaroid'
  | 'polaroid_cream'
  | 'polaroid_black'
  | 'glass'
  | 'glass_aurora'
  | 'frame_dark'
  | 'frame_gold'
  | 'frame_wood'
  | 'minimal'
  | 'matte_gallery'
  | 'film_strip'
  | 'ticket'
  | 'neon'
  | 'postage'
  | 'soft_round';

export type DateFormatId = 'dot' | 'ko';

export type BinderId = string;
export type CardId = string;

export interface Binder {
  id: BinderId;
  name: string;
  createdAt: string; // ISO
}

export interface Card {
  id: CardId;
  binderId: BinderId | null; // null = 미분류
  sealedAt: string; // ISO — frozen
  templateId: TemplateId; // frozen
  dateFormatId: DateFormatId; // frozen
  imagePath: string; // sealed composite absolute path — frozen
  width: number;
  height: number;
}

export interface Settings {
  defaultTemplateId: TemplateId;
  dateFormatId: DateFormatId;
  /** P3 home widget pointer — null = unset */
  widgetBinderId?: BinderId | null;
  /** null = latest card in widgetBinderId */
  widgetCardId?: CardId | null;
}

export interface DbSnapshot {
  version: 1;
  binders: Binder[];
  cards: Card[];
  settings: Settings;
}

export const UNCATEGORIZED_LABEL = '미분류';

export const DEFAULT_SETTINGS: Settings = {
  defaultTemplateId: 'polaroid',
  dateFormatId: 'dot',
  widgetBinderId: null,
  widgetCardId: null,
};

/** Presentation renderer output profile (§14.3) */
export type PresentationProfile = 'screen' | 'share' | 'wallpaper' | 'widget';
