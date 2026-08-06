import type { DateFormatId, TemplateId } from '../domain/types';

export type RootScreen =
  | { name: 'binders' }
  | { name: 'binderDetail'; binderId: string | null }
  | { name: 'cardDetail'; cardId: string; fromBinderId?: string | null }
  | { name: 'sealCamera' }
  | {
      name: 'sealPreview';
      photoUri: string;
      templateId: TemplateId;
      dateFormatId: DateFormatId;
      sealedAtIso: string;
    }
  | {
      name: 'pickBinder';
      photoUri: string;
      templateId: TemplateId;
      dateFormatId: DateFormatId;
      sealedAtIso: string;
      compositeUri: string;
      width: number;
      height: number;
    }
  | { name: 'settings' };
