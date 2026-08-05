import type { TemplateId } from './types';

export interface TemplateSpec {
  id: TemplateId;
  label: string;
  /** Outer card aspect: width / height */
  aspect: number;
  /** Photo area as fraction of card (padding around photo) */
  photoInset: number;
  /** Bottom band reserved for date (fraction of height) */
  dateBand: number;
  background: string;
  borderColor: string;
  borderWidth: number;
  dateColor: string;
  dateAlign: 'left' | 'center' | 'right';
}

export const TEMPLATES: Record<TemplateId, TemplateSpec> = {
  polaroid: {
    id: 'polaroid',
    label: '폴라로이드',
    aspect: 0.8,
    photoInset: 0.06,
    dateBand: 0.14,
    background: '#F7F4EF',
    borderColor: '#E8E2D9',
    borderWidth: 1,
    dateColor: '#3A3A3A',
    dateAlign: 'left',
  },
  frame_dark: {
    id: 'frame_dark',
    label: '다크 프레임',
    aspect: 0.75,
    photoInset: 0.05,
    dateBand: 0.12,
    background: '#1A1A1A',
    borderColor: '#333333',
    borderWidth: 1,
    dateColor: '#F0F0F0',
    dateAlign: 'center',
  },
  minimal: {
    id: 'minimal',
    label: '미니멀',
    aspect: 0.85,
    photoInset: 0.03,
    dateBand: 0.1,
    background: '#FFFFFF',
    borderColor: '#DDDDDD',
    borderWidth: 1,
    dateColor: '#666666',
    dateAlign: 'right',
  },
};

export const TEMPLATE_LIST: TemplateSpec[] = [
  TEMPLATES.polaroid,
  TEMPLATES.frame_dark,
  TEMPLATES.minimal,
];
