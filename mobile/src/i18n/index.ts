import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import type { LocalePreference } from '../domain/types';
import { en } from './locales/en';
import { ja } from './locales/ja';
import { ko } from './locales/ko';

export type { LocalePreference };
export type AppLocale = 'ko' | 'ja' | 'en';

const i18n = new I18n({ en, ko, ja });
i18n.defaultLocale = 'en';
i18n.enableFallback = true;
i18n.locale = 'en';

export function resolveDeviceLocale(): AppLocale {
  const tag = getLocales()[0]?.languageTag ?? 'en';
  const lang = tag.toLowerCase();
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('ja')) return 'ja';
  return 'en';
}

export function resolveEffectiveLocale(pref: LocalePreference): AppLocale {
  if (pref === 'system') return resolveDeviceLocale();
  return pref;
}

export function setAppLocale(locale: AppLocale): void {
  i18n.locale = locale;
}

export function t(
  key: string,
  options?: Record<string, string | number>,
): string {
  return i18n.t(key, options);
}

export function getI18n(): I18n {
  return i18n;
}
