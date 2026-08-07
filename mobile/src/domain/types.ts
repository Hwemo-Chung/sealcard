/** Sealcard domain — sealed cards are immutable after create. */

export type TemplateId =
  | 'polaroid'
  | 'polaroid_cream'
  | 'polaroid_black'
  | 'frame_dark'
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

/** User locale preference; system follows device (ko*, ja*, else en). */
export type LocalePreference = 'system' | 'ko' | 'ja' | 'en';

/** Card detail floating action pill dock */
export type ActionNavPosition = 'top' | 'bottom';

export interface Settings {
  defaultTemplateId: TemplateId;
  dateFormatId: DateFormatId;
  /** UI language; default system */
  locale: LocalePreference;
  /** Stamp date on sealed card chrome (default true) */
  showDate: boolean;
  /** Stamp place name from device GPS (default false; on-device only) */
  showLocation: boolean;
  /** Stamp binder title on sealed card chrome (default false) */
  showBinderName: boolean;
  /** Card detail action pill: above gallery or below meta */
  actionNavPosition: ActionNavPosition;
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

export const DEFAULT_SETTINGS: Settings = {
  defaultTemplateId: 'polaroid',
  dateFormatId: 'dot',
  locale: 'system',
  showDate: true,
  showLocation: false,
  showBinderName: false,
  actionNavPosition: 'bottom',
  widgetBinderId: null,
  widgetCardId: null,
};

/** Presentation renderer output profile (§14.3) */
export type PresentationProfile = 'screen' | 'share' | 'wallpaper' | 'widget';
