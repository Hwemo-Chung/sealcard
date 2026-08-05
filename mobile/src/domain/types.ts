/** Sealcard domain — sealed cards are immutable after create. */

export type TemplateId = 'polaroid' | 'frame_dark' | 'minimal';

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
};
