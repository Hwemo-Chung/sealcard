import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { LocalePreference } from '../domain/types';
import * as repo from '../storage/repository';
import {
  resolveEffectiveLocale,
  setAppLocale,
  t as translate,
  type AppLocale,
} from './index';

type Ctx = {
  locale: AppLocale;
  preference: LocalePreference;
  setPreference: (p: LocalePreference) => Promise<void>;
  t: typeof translate;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({
  initialPreference,
  children,
}: {
  initialPreference: LocalePreference;
  children: React.ReactNode;
}) {
  const [preference, setPrefState] = useState<LocalePreference>(initialPreference);
  const [locale, setLocaleState] = useState<AppLocale>(() =>
    resolveEffectiveLocale(initialPreference),
  );

  useEffect(() => {
    const next = resolveEffectiveLocale(preference);
    setAppLocale(next);
    setLocaleState(next);
  }, [preference]);

  const setPreference = useCallback(async (p: LocalePreference) => {
    await repo.updateSettings({ locale: p });
    setPrefState(p);
  }, []);

  const value = useMemo(
    () => ({ locale, preference, setPreference, t: translate }),
    [locale, preference, setPreference],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}
