import type { TemplateId } from './types';
import { t } from '../i18n';

export type FrameStyle =
  | 'polaroid'
  | 'glass'
  | 'matte'
  | 'ornate'
  | 'film'
  | 'ticket'
  | 'neon'
  | 'postage'
  | 'soft';

/** Picker category chips — keeps 15 frames scannable */
export type TemplateCategoryId =
  | 'instant'
  | 'glass'
  | 'gallery'
  | 'film'
  | 'play';

export const TEMPLATE_CATEGORY_IDS: TemplateCategoryId[] = [
  'instant',
  'glass',
  'gallery',
  'film',
  'play',
];

export interface TemplateSpec {
  id: TemplateId;
  category: TemplateCategoryId;
  style: FrameStyle;
  /** Transparent PNG overlay under assets/frames/ */
  overlayAsset?: number;
  /** Outer card aspect: width / height */
  aspect: number;
  /** Photo area inset as fraction of card width */
  photoInset: number;
  /** Bottom band reserved for date (fraction of height) */
  dateBand: number;
  background: string;
  /** Optional second fill for dual-tone / matte */
  backgroundAlt?: string;
  borderColor: string;
  borderWidth: number;
  /** Outer glow / secondary rim */
  rimColor?: string;
  rimWidth?: number;
  cornerRadius: number;
  photoRadius: number;
  dateColor: string;
  dateAlign: 'left' | 'center' | 'right';
  dateWeight: '400' | '500' | '600' | '700';
  dateLetterSpacing: number;
  /** Glass highlight strip */
  glassHighlight?: boolean;
  /** Soft outer shadow strength 0–1 */
  shadow: number;
  /** Accent bar under photo (ornate/ticket) */
  accentColor?: string;
  /** Film sprocket / postage teeth */
  deco?: 'sprocket' | 'perforation' | 'none';
  /** Preview chip colors for picker */
  chipFrom: string;
  chipTo: string;
}

/** require() map — Metro needs static requires */
export const FRAME_OVERLAYS: Partial<Record<TemplateId, number>> = {
  polaroid: require('../../assets/frames/polaroid.png'),
  polaroid_cream: require('../../assets/frames/polaroid_cream.png'),
  polaroid_black: require('../../assets/frames/polaroid_black.png'),
  glass: require('../../assets/frames/glass.png'),
  glass_aurora: require('../../assets/frames/glass_aurora.png'),
  frame_dark: require('../../assets/frames/frame_dark.png'),
  frame_gold: require('../../assets/frames/frame_gold.png'),
  frame_wood: require('../../assets/frames/frame_wood.png'),
  minimal: require('../../assets/frames/minimal.png'),
  matte_gallery: require('../../assets/frames/matte_gallery.png'),
  film_strip: require('../../assets/frames/film_strip.png'),
  ticket: require('../../assets/frames/ticket.png'),
  neon: require('../../assets/frames/neon.png'),
  postage: require('../../assets/frames/postage.png'),
  soft_round: require('../../assets/frames/soft_round.png'),
};

export const PRESENTATION_MATTE = require('../../assets/frames/presentation_matte.png');

export const TEMPLATES: Record<TemplateId, TemplateSpec> = {
  polaroid: {
    id: 'polaroid',
    category: 'instant',
    style: 'polaroid',
    aspect: 0.8,
    photoInset: 0.055,
    dateBand: 0.16,
    background: '#FAF8F5',
    borderColor: '#EDE8E1',
    borderWidth: 1,
    cornerRadius: 2,
    photoRadius: 0,
    dateColor: '#2C2C2C',
    dateAlign: 'left',
    dateWeight: '500',
    dateLetterSpacing: 0.4,
    shadow: 0.28,
    chipFrom: '#FAF8F5',
    chipTo: '#E8E2D9',
  },
  polaroid_cream: {
    id: 'polaroid_cream',
    category: 'instant',
    style: 'polaroid',
    aspect: 0.78,
    photoInset: 0.06,
    dateBand: 0.18,
    background: '#F3EBD9',
    borderColor: '#E0D4BC',
    borderWidth: 1,
    cornerRadius: 3,
    photoRadius: 0,
    dateColor: '#5C4A32',
    dateAlign: 'left',
    dateWeight: '500',
    dateLetterSpacing: 0.6,
    shadow: 0.3,
    chipFrom: '#F3EBD9',
    chipTo: '#D9C8A8',
  },
  polaroid_black: {
    id: 'polaroid_black',
    category: 'instant',
    style: 'polaroid',
    aspect: 0.8,
    photoInset: 0.05,
    dateBand: 0.15,
    background: '#141414',
    borderColor: '#2A2A2A',
    borderWidth: 1,
    cornerRadius: 2,
    photoRadius: 0,
    dateColor: '#E8E8E8',
    dateAlign: 'center',
    dateWeight: '600',
    dateLetterSpacing: 1.2,
    shadow: 0.4,
    chipFrom: '#1A1A1A',
    chipTo: '#333',
  },
  glass: {
    id: 'glass',
    category: 'glass',
    style: 'glass',
    aspect: 0.82,
    photoInset: 0.07,
    dateBand: 0.13,
    background: 'rgba(255,255,255,0.14)',
    backgroundAlt: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.45)',
    borderWidth: 1.5,
    rimColor: 'rgba(255,255,255,0.12)',
    rimWidth: 6,
    cornerRadius: 18,
    photoRadius: 12,
    dateColor: 'rgba(255,255,255,0.92)',
    dateAlign: 'center',
    dateWeight: '600',
    dateLetterSpacing: 0.8,
    glassHighlight: true,
    shadow: 0.35,
    chipFrom: '#7EB8FF',
    chipTo: '#C9A0FF',
  },
  glass_aurora: {
    id: 'glass_aurora',
    category: 'glass',
    style: 'glass',
    aspect: 0.8,
    photoInset: 0.075,
    dateBand: 0.12,
    background: 'rgba(120,80,200,0.22)',
    backgroundAlt: 'rgba(40,180,200,0.12)',
    borderColor: 'rgba(220,200,255,0.55)',
    borderWidth: 1.5,
    rimColor: 'rgba(180,120,255,0.18)',
    rimWidth: 8,
    cornerRadius: 20,
    photoRadius: 14,
    dateColor: '#F4EEFF',
    dateAlign: 'center',
    dateWeight: '600',
    dateLetterSpacing: 1,
    glassHighlight: true,
    shadow: 0.38,
    chipFrom: '#A78BFA',
    chipTo: '#22D3EE',
  },
  frame_dark: {
    id: 'frame_dark',
    category: 'gallery',
    style: 'matte',
    aspect: 0.75,
    photoInset: 0.08,
    dateBand: 0.11,
    background: '#0D0D0D',
    backgroundAlt: '#1A1A1A',
    borderColor: '#2E2E2E',
    borderWidth: 1,
    cornerRadius: 4,
    photoRadius: 2,
    dateColor: '#CFCFCF',
    dateAlign: 'center',
    dateWeight: '500',
    dateLetterSpacing: 1.4,
    shadow: 0.45,
    chipFrom: '#111',
    chipTo: '#444',
  },
  frame_gold: {
    id: 'frame_gold',
    category: 'gallery',
    style: 'ornate',
    aspect: 0.72,
    photoInset: 0.09,
    dateBand: 0.12,
    background: '#1C1812',
    borderColor: '#C9A227',
    borderWidth: 3,
    rimColor: '#8B6914',
    rimWidth: 2,
    cornerRadius: 6,
    photoRadius: 2,
    dateColor: '#E8D5A3',
    dateAlign: 'center',
    dateWeight: '600',
    dateLetterSpacing: 1.6,
    accentColor: '#C9A227',
    shadow: 0.4,
    chipFrom: '#C9A227',
    chipTo: '#5C4A1F',
  },
  frame_wood: {
    id: 'frame_wood',
    category: 'gallery',
    style: 'ornate',
    aspect: 0.74,
    photoInset: 0.085,
    dateBand: 0.12,
    background: '#3E2A1A',
    backgroundAlt: '#5C3D24',
    borderColor: '#8B5E34',
    borderWidth: 4,
    rimColor: '#2A1A10',
    rimWidth: 2,
    cornerRadius: 4,
    photoRadius: 1,
    dateColor: '#F0E0C8',
    dateAlign: 'center',
    dateWeight: '500',
    dateLetterSpacing: 0.8,
    accentColor: '#A67C52',
    shadow: 0.42,
    chipFrom: '#8B5E34',
    chipTo: '#3E2A1A',
  },
  minimal: {
    id: 'minimal',
    category: 'gallery',
    style: 'matte',
    aspect: 0.85,
    photoInset: 0.028,
    dateBand: 0.09,
    background: '#FFFFFF',
    borderColor: '#E5E5E5',
    borderWidth: 1,
    cornerRadius: 0,
    photoRadius: 0,
    dateColor: '#888888',
    dateAlign: 'right',
    dateWeight: '400',
    dateLetterSpacing: 0.2,
    shadow: 0.12,
    chipFrom: '#FFFFFF',
    chipTo: '#DDDDDD',
  },
  matte_gallery: {
    id: 'matte_gallery',
    category: 'gallery',
    style: 'matte',
    aspect: 0.7,
    photoInset: 0.12,
    dateBand: 0.1,
    background: '#F2F0EB',
    backgroundAlt: '#E8E4DC',
    borderColor: '#D4CFC4',
    borderWidth: 1,
    cornerRadius: 0,
    photoRadius: 0,
    dateColor: '#6B6560',
    dateAlign: 'center',
    dateWeight: '400',
    dateLetterSpacing: 2,
    shadow: 0.18,
    chipFrom: '#F2F0EB',
    chipTo: '#C9C3B8',
  },
  film_strip: {
    id: 'film_strip',
    category: 'film',
    style: 'film',
    aspect: 0.7,
    photoInset: 0.11,
    dateBand: 0.1,
    background: '#0A0A0A',
    borderColor: '#1F1F1F',
    borderWidth: 0,
    cornerRadius: 4,
    photoRadius: 0,
    dateColor: '#B8B8B8',
    dateAlign: 'center',
    dateWeight: '600',
    dateLetterSpacing: 2,
    deco: 'sprocket',
    shadow: 0.35,
    chipFrom: '#111',
    chipTo: '#555',
  },
  ticket: {
    id: 'ticket',
    category: 'film',
    style: 'ticket',
    aspect: 0.62,
    photoInset: 0.06,
    dateBand: 0.14,
    background: '#FFF9F0',
    borderColor: '#E8D9C4',
    borderWidth: 1,
    cornerRadius: 8,
    photoRadius: 4,
    dateColor: '#5A4030',
    dateAlign: 'center',
    dateWeight: '700',
    dateLetterSpacing: 1.5,
    accentColor: '#D4533B',
    shadow: 0.22,
    chipFrom: '#FFF9F0',
    chipTo: '#D4533B',
  },
  neon: {
    id: 'neon',
    category: 'play',
    style: 'neon',
    aspect: 0.8,
    photoInset: 0.06,
    dateBand: 0.11,
    background: '#050508',
    borderColor: '#00F0FF',
    borderWidth: 2,
    rimColor: '#FF2BD6',
    rimWidth: 1,
    cornerRadius: 14,
    photoRadius: 8,
    dateColor: '#00F0FF',
    dateAlign: 'center',
    dateWeight: '700',
    dateLetterSpacing: 2,
    shadow: 0.5,
    chipFrom: '#00F0FF',
    chipTo: '#FF2BD6',
  },
  postage: {
    id: 'postage',
    category: 'film',
    style: 'postage',
    aspect: 0.78,
    photoInset: 0.1,
    dateBand: 0.12,
    background: '#F7F2E8',
    borderColor: '#C4B8A4',
    borderWidth: 2,
    cornerRadius: 2,
    photoRadius: 2,
    dateColor: '#4A4035',
    dateAlign: 'center',
    dateWeight: '600',
    dateLetterSpacing: 0.5,
    deco: 'perforation',
    shadow: 0.2,
    chipFrom: '#F7F2E8',
    chipTo: '#A89880',
  },
  soft_round: {
    id: 'soft_round',
    category: 'play',
    style: 'soft',
    aspect: 0.84,
    photoInset: 0.05,
    dateBand: 0.12,
    background: '#FFF5F7',
    borderColor: '#FFD6E0',
    borderWidth: 2,
    cornerRadius: 24,
    photoRadius: 16,
    dateColor: '#8B4A5C',
    dateAlign: 'center',
    dateWeight: '500',
    dateLetterSpacing: 0.4,
    shadow: 0.25,
    chipFrom: '#FFF5F7',
    chipTo: '#FF9BB0',
  },
};

export const TEMPLATE_LIST: TemplateSpec[] = [
  TEMPLATES.polaroid,
  TEMPLATES.polaroid_cream,
  TEMPLATES.polaroid_black,
  TEMPLATES.glass,
  TEMPLATES.glass_aurora,
  TEMPLATES.frame_dark,
  TEMPLATES.frame_gold,
  TEMPLATES.frame_wood,
  TEMPLATES.minimal,
  TEMPLATES.matte_gallery,
  TEMPLATES.film_strip,
  TEMPLATES.ticket,
  TEMPLATES.neon,
  TEMPLATES.postage,
  TEMPLATES.soft_round,
];


export function templateLabel(id: TemplateId): string {
  return t(`template.${id}_label`);
}

export function templateSubtitle(id: TemplateId): string {
  return t(`template.${id}_sub`);
}

export function categoryLabel(id: TemplateCategoryId | 'all'): string {
  return t(`category.${id}`);
}

/** Layout numbers shared by CardFace and live camera (WYSIWYG). */
export function cardLayout(templateId: string | undefined | null, width: number) {
  const t = resolveTemplate(templateId);
  const height = width / t.aspect;
  const inset = width * t.photoInset;
  const dateBandH = height * t.dateBand;
  const photoH = Math.max(1, height - inset * 2 - dateBandH);
  const photoW = Math.max(1, width - inset * 2);
  return { t, height, inset, dateBandH, photoW, photoH };
}

export function resolveTemplate(id: string | undefined | null): TemplateSpec {
  if (id && id in TEMPLATES) return TEMPLATES[id as TemplateId];
  return TEMPLATES.polaroid;
}

export function isTemplateId(id: string): id is TemplateId {
  return id in TEMPLATES;
}

export function templatesInCategory(cat: TemplateCategoryId | 'all'): TemplateSpec[] {
  if (cat === 'all') return TEMPLATE_LIST;
  return TEMPLATE_LIST.filter((t) => t.category === cat);
}

export function frameOverlaySource(id: TemplateId | string): number | undefined {
  return FRAME_OVERLAYS[id as TemplateId];
}
