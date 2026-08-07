# Sealcard Google Play 실배포 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sealcard를 EAS production AAB로 빌드하고, ko/ja/en i18n·정책 URL·스토어 메타를 갖춘 뒤 Play Internal → Production까지 제출 가능하게 만든다.

**Architecture:** Expo managed 앱에 `i18n-js` + `expo-localization` 카탈로그를 두고 Settings.locale로 덮어쓴다. 출시 빌드는 EAS Build(AAB) + EAS Submit. 개인정보처리방침은 별 레포 `Hwemo-Chung.github.io`의 정적 HTML. 스토어 카피·체크리스트는 `mobile/store/`.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript, i18n-js, expo-localization, EAS CLI, Google Play Console, GitHub Pages.

**Spec:** [docs/superpowers/specs/2026-08-07-play-store-release-design.md](../specs/2026-08-07-play-store-release-design.md)

## Global Constraints

- 표시명 **Sealcard**, package **`app.sealcard.mobile`** — 변경 금지
- 언어: 앱 UI · 리스팅 · 정책 = **ko / ja / en**; 기본 locale **`system`** (ko*→ko, ja*→ja, else→en)
- 무료 · IAP 없음 · 광고·분석 SDK 없음 · 서버 전송 없음
- 정책 URL 고정: `https://hwemo-chung.github.io/sealcard-privacy.html`
- Play 리스팅에 **네이티브 홈 위젯 제공 주장 금지**
- 금지 카피: 마법, AI, 해금, 희귀, SR, 피드, 스토리 자랑
- 로컬 `android/` · `ios/` 커밋 금지; keystore·Play JSON 커밋 금지
- `SUPPORT_EMAIL`: 구현 전 사용자 확정값. 미확정이면 `mobile/src/config.ts`에 두고 **P7 전 반드시 실주소로 교체**
- 작업 루트 앱: `mobile/` · 정책 레포: `/Users/solution/Documents/GitHub/01_deployable/Hwemo-Chung.github.io`
- 검증 없이 “완료/배포됨” 선언 금지; `npm run typecheck` + 해당 태스크 검증 필수
- `as any` / `@ts-ignore` 신규 금지

---

## File map

| Path | Responsibility |
|------|----------------|
| `mobile/src/config.ts` | SUPPORT_EMAIL, PRIVACY_POLICY_URL, APP 상수 |
| `mobile/src/i18n/locales/en.ts` | 키 소스 오브 트루스 |
| `mobile/src/i18n/locales/ko.ts` | 한국어 |
| `mobile/src/i18n/locales/ja.ts` | 日本語 |
| `mobile/src/i18n/index.ts` | i18n init, `t`, `setAppLocale`, `resolveDeviceLocale` |
| `mobile/src/i18n/I18nProvider.tsx` | React context + locale tick 리렌더 |
| `mobile/src/i18n/keys.test.ts` | en 키 ⊆ ko/ja |
| `mobile/src/domain/types.ts` | `Settings.locale` |
| `mobile/src/domain/templates.ts` | label/subtitle → i18n key id only (또는 getter) |
| `mobile/src/screens/*` | 하드코딩 제거 → `t()` |
| `mobile/src/presentation/*` | Alert/버튼 문자열 `t()` |
| `mobile/App.tsx` | I18nProvider, settings.locale 로드 |
| `mobile/app.json` | versionCode, splash, eas projectId |
| `mobile/eas.json` | build/submit profiles |
| `mobile/package.json` | deps + scripts |
| `mobile/store/listing-{ko,en,ja}.md` | 스토어 카피 |
| `mobile/store/data-safety.md` | Data Safety 답변 |
| `mobile/store/play-checklist.md` | Console·자격 증명 절차 |
| `mobile/store/assets/*` | feature graphic, screenshots |
| `Hwemo-Chung.github.io/sealcard-privacy.html` | 정책 3언어 |
| `Hwemo-Chung.github.io/sitemap.xml` | URL 추가 |

---

### Task 1: i18n 코어 + locale resolve + 키 패리티 테스트

**Files:**
- Create: `mobile/src/config.ts`
- Create: `mobile/src/i18n/locales/en.ts`
- Create: `mobile/src/i18n/locales/ko.ts`
- Create: `mobile/src/i18n/locales/ja.ts`
- Create: `mobile/src/i18n/index.ts`
- Create: `mobile/src/i18n/keys.test.ts`
- Modify: `mobile/package.json` (deps + test script)
- Modify: `mobile/src/domain/types.ts` (`locale` on Settings)

**Interfaces:**
- Produces:
  - `PRIVACY_POLICY_URL: string`
  - `SUPPORT_EMAIL: string`
  - `type AppLocale = 'ko' | 'ja' | 'en'`
  - `type LocalePreference = 'system' | AppLocale`
  - `resolveDeviceLocale(): AppLocale`
  - `resolveEffectiveLocale(pref: LocalePreference): AppLocale`
  - `setAppLocale(locale: AppLocale): void`
  - `t(key: string, options?: Record<string, string | number>): string`
  - `getI18n(): I18n`
  - `Settings.locale?: LocalePreference` (default `'system'`)

- [ ] **Step 1: Install dependencies**

```bash
cd mobile
npx expo install expo-localization
npm install i18n-js
# test runner if missing — use node assert for keys.test.ts via tsx or add:
npm install -D tsx
```

`package.json` scripts에 추가:

```json
"test": "tsx --test src/**/*.test.ts src/i18n/keys.test.ts",
"typecheck": "tsc --noEmit"
```

(기존 `immutability.test.ts`가 있으면 동일 runner로 포함. 기존 테스트 방식이 있으면 그에 맞춤.)

- [ ] **Step 2: Write failing key-parity test**

Create `mobile/src/i18n/keys.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { en } from './locales/en';
import { ko } from './locales/ko';
import { ja } from './locales/ja';

function leafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...leafKeys(v as Record<string, unknown>, path));
    } else {
      out.push(path);
    }
  }
  return out.sort();
}

describe('i18n key parity', () => {
  it('ko and ja have exactly the same keys as en', () => {
    const enKeys = leafKeys(en as unknown as Record<string, unknown>);
    const koKeys = leafKeys(ko as unknown as Record<string, unknown>);
    const jaKeys = leafKeys(ja as unknown as Record<string, unknown>);
    assert.deepEqual(koKeys, enKeys, 'ko keys differ from en');
    assert.deepEqual(jaKeys, enKeys, 'ja keys differ from en');
  });
});
```

- [ ] **Step 3: Run test — expect FAIL (modules missing)**

```bash
cd mobile && npm test
```

Expected: FAIL cannot find module `./locales/en` 등.

- [ ] **Step 4: Create config + full locale catalogs**

`mobile/src/config.ts`:

```ts
/** Play Console · privacy page · in-app support — replace before P7 submit. */
export const SUPPORT_EMAIL = 'REPLACE_BEFORE_SUBMIT@example.com';

export const PRIVACY_POLICY_URL =
  'https://hwemo-chung.github.io/sealcard-privacy.html';

export const APP_DISPLAY_NAME = 'Sealcard';
export const ANDROID_PACKAGE = 'app.sealcard.mobile';
```

`mobile/src/i18n/locales/en.ts` — **전체 키 트리** (이후 화면이 이 키만 사용):

```ts
export const en = {
  common: {
    back: 'Back',
    cancel: 'Cancel',
    close: 'Close',
    retry: 'Try again',
    appName: 'Sealcard',
  },
  binders: {
    title: 'Binders',
    settingsA11y: 'Settings',
    settings: 'Settings',
    hint: 'Keep sealed cards in series binders.',
    emptyTitle: 'Create your first series',
    emptyBody: 'Seal a photo and it goes into a binder. You cannot edit after sealing.',
    seal: 'Seal',
    sealPlus: 'Seal+',
    sealStartA11y: 'Start sealing',
    cardCount: '%{count} cards',
    rowA11y: '%{name}, %{count} cards',
  },
  binderDetail: {
    fallbackTitle: 'Binder',
    deleteTitle: 'Delete this binder?',
    deleteBody: 'Only the binder is removed. Cards move to Uncategorized.',
    deleteAction: 'Delete binder',
    meta: '%{count} cards · newest first',
    modeGrid: 'Grid',
    modePresent: 'Exhibit',
    empty: 'No cards yet.',
    cardDetail: 'Card details',
  },
  cardDetail: {
    notFound: 'Card not found.',
    destroyTitle: 'Destroy this card?',
    destroyBody: 'You cannot undo destruction.',
    destroy: 'Destroy',
    destroyA11y: 'Destroy card',
    frozen: 'Photo, date, and template cannot be changed.',
    move: 'Move to another binder',
    binderLine: 'Binder · %{name}',
    uncategorized: 'Uncategorized',
  },
  sealCamera: {
    needPermissionTitle: 'Camera permission required',
    needPermissionBody: 'Camera access is required to take a photo.',
    allow: 'Allow camera',
    banner: 'Once sealed, it cannot be edited',
    flip: 'Flip',
    flipA11y: 'Switch camera',
    frame: 'Frame',
    shutterA11y: 'Shutter',
  },
  sealPreview: {
    title: 'Preview',
    asSeen: '%{template} · Sealed exactly as shown.',
    confirmTitle: 'Seal this card?',
    confirmBody:
      'After sealing, you cannot change the photo, date, or template.\nYou can move the binder later.',
    seal: 'Seal',
    sealA11y: 'Seal',
    retake: 'Retake',
    failTitle: 'Could not seal',
    failBody: 'Please try again.',
  },
  pickBinder: {
    title: 'Which series?',
    empty: 'No series yet. Create one below.',
    placeholder: 'Series name',
    newBinder: 'New binder',
    finish: 'Place and finish sealing',
    needSelect: 'Choose a series',
    defaultName: 'My first series',
    failTitle: 'Could not seal',
    failBody: 'Please try again.',
  },
  settings: {
    title: 'Settings',
    defaultFrame: 'Default frame',
    defaultFrameHint: 'Default when shooting. Pick by category.',
    dateFormat: 'Date format',
    language: 'Language',
    languageSystem: 'System default',
    languageKo: '한국어',
    languageJa: '日本語',
    languageEn: 'English',
    widgetSection: 'Home widget (preview)',
    widgetHint:
      'In-app target for a future home widget. Pin from card detail or exhibit. Not a store-claimed widget until native ships.',
    widgetCard: 'Pinned card · %{id}…',
    widgetBinder: 'Latest in binder · %{id}…',
    widgetUnset: 'Not set',
    widgetClear: 'Clear widget target',
    about: 'About',
    version: 'Version %{version}',
    privacy: 'Privacy policy',
    contact: 'Contact',
  },
  present: {
    share: 'Share image',
    shareA11y: 'Share as image',
    wallpaper: 'Save for wallpaper',
    wallpaperA11y: 'Save for wallpaper',
    widgetPin: 'Pin for widget…',
    widgetPinA11y: 'Pin for widget',
    shareFailTitle: 'Could not share',
    shareFailBody: 'Please try again.',
    saveFailTitle: 'Could not save',
    saveFailBody: 'Please try again.',
    widgetTitle: 'Pin for widget',
    widgetBody: 'Pin this card (or latest in binder) as the in-app widget target.',
    widgetThisCard: 'This card',
    widgetBinderLatest: 'Latest in binder',
    widgetPinnedTitle: 'Pinned',
    widgetPinnedCardBody:
      'Target saved in the app. A native home-screen widget is not included in this release.',
    widgetPinnedBinderBody:
      'Latest card in that binder is the target. Native home widget is not in this release.',
    cannotShareTitle: 'Sharing unavailable',
    cannotShareBody: 'This device cannot open the share sheet.',
    needPhotosTitle: 'Permission required',
    needPhotosBody: 'Photo library permission is required to save a wallpaper image.',
    savedTitle: 'Saved',
    savedBody:
      'Set it as wallpaper from the Sealcard album in your gallery (path varies by device).',
    savedFallbackBody: 'Open the image in Photos and set it as wallpaper.',
    widgetPreviewEmpty: 'No widget target. Pin from a card.',
    widgetPreviewCaption: 'Widget preview',
  },
  category: {
    instant: 'Instant',
    glass: 'Glass',
    gallery: 'Gallery',
    film: 'Film & ticket',
    play: 'Play',
  },
  template: {
    polaroid_label: 'Polaroid',
    polaroid_sub: 'Classic white border',
    polaroid_cream_label: 'Cream pola',
    polaroid_cream_sub: 'Warm ivory',
    polaroid_black_label: 'Black pola',
    polaroid_black_sub: 'Dark instant',
    glass_label: 'Glass',
    glass_sub: 'Glassmorphism',
    glass_aurora_label: 'Aurora glass',
    glass_aurora_sub: 'Violet glass',
    frame_dark_label: 'Dark frame',
    frame_dark_sub: 'Gallery black',
    frame_gold_label: 'Gold frame',
    frame_gold_sub: 'Ornate gold',
    frame_wood_label: 'Wood frame',
    frame_wood_sub: 'Warm wood',
    minimal_label: 'Minimal',
    minimal_sub: 'Thin white',
    matte_gallery_label: 'Gallery matte',
    matte_gallery_sub: 'Wide margin',
    film_strip_label: 'Film strip',
    film_strip_sub: 'Sprocket holes',
    ticket_label: 'Ticket',
    ticket_sub: 'Stub-cut feel',
    neon_label: 'Neon',
    neon_sub: 'Glow border',
    postage_label: 'Postage',
    postage_sub: 'Perforated edge',
    soft_round_label: 'Soft round',
    soft_round_sub: 'Rounded card',
  },
} as const;

export type TranslationTree = typeof en;
```

`ko.ts` / `ja.ts`: 동일 키 트리. 한국어는 현재 UI 문자열을 이식. 일본어는 봉인 의미 (`封じて` / `シール` 스티커 혼동 주의 — 제품 동사는 封じる·密封 계열).

예 (ko 발췌 — **전체 키를 en과 1:1로 채울 것**):

```ts
import type { TranslationTree } from './en';

export const ko: TranslationTree = {
  common: {
    back: '뒤로',
    cancel: '취소',
    close: '닫기',
    retry: '다시 시도',
    appName: 'Sealcard',
  },
  binders: {
    title: '바인더',
    // ... 나머지 en 키 전부
  },
  // ...
};
```

`TranslationTree`를 타입으로 쓰면 ko/ja 키 누락이 **컴파일 타임**에 잡힌다. `as const` en + `satisfies` 또는 명시 타입 중 프로젝트 TS 버전에 맞게.

- [ ] **Step 5: Implement `mobile/src/i18n/index.ts`**

```ts
import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import { en } from './locales/en';
import { ja } from './locales/ja';
import { ko } from './locales/ko';

export type AppLocale = 'ko' | 'ja' | 'en';
export type LocalePreference = 'system' | AppLocale;

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
```

- [ ] **Step 6: Extend Settings type**

In `mobile/src/domain/types.ts`:

```ts
import type { LocalePreference } from '../i18n'; // or define LocalePreference in types to avoid cycle

// Prefer defining in types.ts:
export type LocalePreference = 'system' | 'ko' | 'ja' | 'en';

export interface Settings {
  defaultTemplateId: TemplateId;
  dateFormatId: DateFormatId;
  locale: LocalePreference;
  widgetBinderId?: BinderId | null;
  widgetCardId?: CardId | null;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultTemplateId: 'polaroid',
  dateFormatId: 'dot',
  locale: 'system',
  widgetBinderId: null,
  widgetCardId: null,
};

// Remove UNCATEGORIZED_LABEL constant usage for UI — use t('cardDetail.uncategorized')
```

If circular import: keep `LocalePreference` in `types.ts`, import it from i18n index only as type for resolve functions.

Remove or deprecate:

```ts
export const UNCATEGORIZED_LABEL = '미분류';
```

Replace call sites in Task 3 with `t('cardDetail.uncategorized')`.

repository already merges `DEFAULT_SETTINGS` — old installs get `locale: 'system'` via spread. Good.

- [ ] **Step 7: Run tests + typecheck**

```bash
cd mobile && npm test && npm run typecheck
```

Expected: key parity PASS; typecheck PASS (screens still Korean until Task 3 — OK).

- [ ] **Step 8: Commit**

```bash
cd /Users/solution/Documents/GitHub/03_planning/sealcard
git add mobile/src/config.ts mobile/src/i18n mobile/src/domain/types.ts mobile/package.json mobile/package-lock.json
git commit -m "feat(i18n): add locale catalogs, resolve, and key parity tests"
```

---

### Task 2: I18nProvider + App 부트 연동

**Files:**
- Create: `mobile/src/i18n/I18nProvider.tsx`
- Modify: `mobile/App.tsx`

**Interfaces:**
- Consumes: `resolveEffectiveLocale`, `setAppLocale`, `repo.getSettings`, `Settings.locale`
- Produces: `useI18n(): { locale: AppLocale; preference: LocalePreference; setPreference: (p: LocalePreference) => Promise<void>; t: typeof t }`

- [ ] **Step 1: Implement provider**

```tsx
// mobile/src/i18n/I18nProvider.tsx
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
```

- [ ] **Step 2: Wire App.tsx**

After settings load:

```tsx
// When settings != null:
<I18nProvider initialPreference={settings.locale ?? 'system'}>
  {/* existing SafeArea / screens */}
</I18nProvider>
```

Boot splash text can stay `Sealcard` (brand).

- [ ] **Step 3: typecheck**

```bash
cd mobile && npm run typecheck
```

- [ ] **Step 4: Commit**

```bash
git add mobile/src/i18n/I18nProvider.tsx mobile/App.tsx
git commit -m "feat(i18n): wire I18nProvider from settings.locale"
```

---

### Task 3: 화면·presentation·repository 문자열을 t()로 치환

**Files:**
- Modify: `mobile/src/screens/BindersScreen.tsx`
- Modify: `mobile/src/screens/BinderDetailScreen.tsx`
- Modify: `mobile/src/screens/CardDetailScreen.tsx`
- Modify: `mobile/src/screens/SealCameraScreen.tsx`
- Modify: `mobile/src/screens/SealPreviewScreen.tsx`
- Modify: `mobile/src/screens/PickBinderScreen.tsx`
- Modify: `mobile/src/screens/SettingsScreen.tsx` (언어 UI는 Task 4)
- Modify: `mobile/src/presentation/PresentActions.tsx`
- Modify: `mobile/src/presentation/capturePresentation.ts`
- Modify: `mobile/src/presentation/WidgetHomePreview.tsx`
- Modify: `mobile/src/storage/repository.ts` (`'나의 첫 시리즈'` → caller passes name or t in screen)
- Modify: `mobile/src/domain/types.ts` (UNCATEGORIZED_LABEL 제거 확인)

**Interfaces:**
- Consumes: `useI18n().t` in components; for non-React modules (`capturePresentation.ts`) import `t` from `i18n/index` (locale already set by provider)

- [ ] **Step 1: Migrate BindersScreen (pattern for all screens)**

```tsx
import { useI18n } from '../i18n/I18nProvider';

export function BindersScreen(...) {
  const { t } = useI18n();
  // ...
  <Text style={styles.title}>{t('binders.title')}</Text>
  <Text style={styles.rowMeta}>{t('binders.cardCount', { count: item.count })}</Text>
}
```

i18n-js interpolation: default `%{name}` syntax — match catalog.

- [ ] **Step 2: Migrate remaining screens and presentation**

Checklist (each string → key from Task 1 catalog):

| File | Keys prefix |
|------|-------------|
| BinderDetailScreen | `binderDetail.*`, `common.back` |
| CardDetailScreen | `cardDetail.*` |
| SealCameraScreen | `sealCamera.*` |
| SealPreviewScreen | `sealPreview.*` |
| PickBinderScreen | `pickBinder.*` |
| PresentActions | `present.*` |
| capturePresentation | `present.cannotShare*`, `needPhotos*`, `saved*` |
| WidgetHomePreview | `present.widgetPreview*` |

Alert buttons: `text: t('common.cancel')`, etc.

- [ ] **Step 3: repository default binder name**

Do **not** call `t` inside repository if locale may be unset. Change:

```ts
// repository createBinder
export async function createBinder(name: string): Promise<Binder> {
  const trimmed = name.trim();
  // require non-empty from caller OR
  const finalName = trimmed.length > 0 ? trimmed : name; // caller must pass t('pickBinder.defaultName')
```

In `PickBinderScreen` when creating with empty field:

```ts
await repo.createBinder(name.trim() || t('pickBinder.defaultName'));
```

Remove hardcoded `'나의 첫 시리즈'` from repository.

- [ ] **Step 4: Grep for leftover Korean UI strings**

```bash
cd mobile && rg -n "['\"][가-힣]" src --glob '!**/locales/**' --glob '!**/*.test.ts'
```

Expected: only comments or intentional residual in templates.ts until Task 5. Fix any screen hits.

- [ ] **Step 5: typecheck + test**

```bash
cd mobile && npm test && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add mobile/src
git commit -m "feat(i18n): replace user-facing strings with t() across screens"
```

---

### Task 4: 설정 — 언어 · 버전 · 정책 · 문의

**Files:**
- Modify: `mobile/src/screens/SettingsScreen.tsx`
- Modify: `mobile/app.json` if needed for version read
- Create or use: `expo-constants` for version

- [ ] **Step 1: Install expo-constants if missing**

```bash
cd mobile && npx expo install expo-constants
```

- [ ] **Step 2: Extend SettingsScreen UI**

```tsx
import Constants from 'expo-constants';
import { Linking } from 'react-native';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '../config';
import { useI18n } from '../i18n/I18nProvider';
import type { LocalePreference } from '../domain/types';

// Inside component:
const { t, preference, setPreference } = useI18n();
const version =
  Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';

// Language rows:
const langs: { id: LocalePreference; labelKey: string }[] = [
  { id: 'system', labelKey: 'settings.languageSystem' },
  { id: 'ko', labelKey: 'settings.languageKo' },
  { id: 'ja', labelKey: 'settings.languageJa' },
  { id: 'en', labelKey: 'settings.languageEn' },
];

// On press: void setPreference(id)

// About section:
// Version, Privacy (Linking.openURL(PRIVACY_POLICY_URL)), Contact (Linking.openURL(`mailto:${SUPPORT_EMAIL}`))
```

Widget section: use `settings.widget*` keys; copy must not claim native home widget (catalog already soft).

- [ ] **Step 3: Manual verify**

Run `npm run android` (or Expo). Switch language system/ko/ja/en — binders title changes. Privacy opens browser. Mailto opens.

- [ ] **Step 4: typecheck + commit**

```bash
cd mobile && npm run typecheck
git add mobile/src/screens/SettingsScreen.tsx mobile/package.json mobile/package-lock.json
git commit -m "feat(settings): language picker, version, privacy and contact links"
```

---

### Task 5: 템플릿·카테고리 라벨 i18n

**Files:**
- Modify: `mobile/src/domain/templates.ts`
- Modify: `mobile/src/components/TemplatePicker.tsx`
- Modify: any screen reading `template.label`

**Interfaces:**
- Produces: `getTemplateLabel(id: TemplateId): string`, `getTemplateSubtitle(id: TemplateId): string`, `getCategoryLabel(id: TemplateCategoryId): string` using `t('template.${id}_label')` etc.

- [ ] **Step 1: Stop storing localized strings on TEMPLATES**

Keep `id`, layout fields. Remove or empty `label`/`subtitle` display fields:

```ts
// templates.ts — remove Korean label/subtitle from TEMPLATES entries
// TEMPLATE_CATEGORIES becomes id-only array
export const TEMPLATE_CATEGORY_IDS: TemplateCategoryId[] = [
  'instant', 'glass', 'gallery', 'film', 'play',
];

export function templateLabel(id: TemplateId): string {
  return t(`template.${id}_label`);
}
export function templateSubtitle(id: TemplateId): string {
  return t(`template.${id}_sub`);
}
export function categoryLabel(id: TemplateCategoryId): string {
  return t(`category.${id}`);
}
```

- [ ] **Step 2: Update TemplatePicker to call helpers**

```tsx
const { t } = useI18n(); // ensures re-render on locale change; helpers use module t()
// display templateLabel(t.id) — but templateLabel uses i18n.t so after setAppLocale + provider tick it updates
```

Prefer calling `t(\`template.${id}_label\`)` inside component with `useI18n` for reliable re-render.

- [ ] **Step 3: SealPreviewScreen uses t for template name**

```tsx
t('sealPreview.asSeen', { template: t(`template.${templateId}_label`) })
```

- [ ] **Step 4: Grep + test**

```bash
cd mobile && rg -n "label: '|subtitle: '" src/domain/templates.ts
npm test && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(i18n): localize template and category labels"
```

---

### Task 6: app.json 출시 필드 + splash

**Files:**
- Modify: `mobile/app.json`

- [ ] **Step 1: Update app.json**

```json
{
  "expo": {
    "name": "Sealcard",
    "slug": "sealcard",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "scheme": "sealcard",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#0F0F0F"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "app.sealcard.mobile",
      "infoPlist": {
        "NSCameraUsageDescription": "카드를 밀봉하기 위해 카메라로 사진을 찍습니다."
      }
    },
    "android": {
      "package": "app.sealcard.mobile",
      "versionCode": 1,
      "adaptiveIcon": {
        "backgroundColor": "#0F0F0F",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "permissions": ["android.permission.CAMERA"],
      "predictiveBackGestureEnabled": false
    },
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "카드를 밀봉하기 위해 카메라로 사진을 찍습니다."
        }
      ],
      "expo-sharing",
      [
        "expo-media-library",
        {
          "photosPermission": "배경화면·공유용 전시 이미지를 저장합니다.",
          "savePhotosPermission": "배경화면·공유용 전시 이미지를 저장합니다.",
          "isAccessMediaLocationEnabled": false
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "REPLACE_AFTER_EAS_INIT"
      }
    },
    "owner": "REPLACE_EXPO_USERNAME"
  }
}
```

`projectId` / `owner`는 Task 8 `eas init` 후 실제 값으로 교체.

- [ ] **Step 2: Validate**

```bash
cd mobile && npx expo config --type public 2>&1 | head -80
```

Expected: no error; android.package `app.sealcard.mobile`.

- [ ] **Step 3: Commit**

```bash
git add mobile/app.json
git commit -m "chore(android): splash, versionCode, release app.json fields"
```

---

### Task 7: 개인정보처리방침 (github.io)

**Files:**
- Create: `/Users/solution/Documents/GitHub/01_deployable/Hwemo-Chung.github.io/sealcard-privacy.html`
- Modify: `/Users/solution/Documents/GitHub/01_deployable/Hwemo-Chung.github.io/sitemap.xml`

**Pattern:** copy structure from `where-privacy.html` (lang switch `#ko` `#ja` `#en`).

- [ ] **Step 1: Write sealcard-privacy.html**

Must include (facts match app):

- App: Sealcard (`app.sealcard.mobile`)
- Provider: Hwemo Chung
- Contact: same as SUPPORT_EMAIL (update when email fixed)
- Short summary: on-device only; no servers, accounts, ads, analytics
- Photos: camera capture; sealed composite in app storage; no in-app edit after seal; destroy deletes
- Optional gallery save when user saves presentation image
- Share: system share sheet only
- Permissions table: CAMERA, photos (save)
- No collection / no transmission
- Not directed at children
- Last updated: 2026-08-07
- Full sections in **Korean, Japanese, English**

Canonical: `https://hwemo-chung.github.io/sealcard-privacy.html`

- [ ] **Step 2: Update sitemap.xml**

Add:

```xml
<url>
  <loc>https://hwemo-chung.github.io/sealcard-privacy.html</loc>
  <lastmod>2026-08-07</lastmod>
</url>
```

- [ ] **Step 3: Commit & push github.io repo**

```bash
cd /Users/solution/Documents/GitHub/01_deployable/Hwemo-Chung.github.io
git add sealcard-privacy.html sitemap.xml
git commit -m "docs: add Sealcard privacy policy (ko/ja/en)"
git push
```

(Push requires user network/auth — if denied, stop and report.)

- [ ] **Step 4: Verify live URL**

```bash
curl -sI https://hwemo-chung.github.io/sealcard-privacy.html | head -5
curl -s https://hwemo-chung.github.io/sealcard-privacy.html | rg -n "Sealcard|개인정보|プライバシー|Privacy" | head
```

Expected: HTTP 200; three languages present.

- [ ] **Step 5: Note in sealcard checklist only** (no app commit required unless SUPPORT_EMAIL synced)

---

### Task 8: EAS 프로젝트 + eas.json + production AAB

**Files:**
- Create: `mobile/eas.json`
- Modify: `mobile/app.json` (real projectId)
- Modify: `mobile/package.json` scripts
- Modify: `mobile/.gitignore` if needed (`*.jks` already)

- [ ] **Step 1: Login & init (user interactive)**

```bash
cd mobile
npx eas-cli login
npx eas-cli init
```

Writes `extra.eas.projectId`. Commit resulting `app.json` changes.

- [ ] **Step 2: Create eas.json**

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

- [ ] **Step 3: Ignore secrets**

Ensure `mobile/.gitignore` contains:

```
play-service-account.json
*.keystore
credentials.json
```

- [ ] **Step 4: package.json scripts**

```json
"build:android": "eas build --platform android --profile production",
"submit:android": "eas submit --platform android --profile production"
```

- [ ] **Step 5: Production build**

```bash
cd mobile && npx eas-cli build --platform android --profile production --non-interactive
```

If credentials prompts block non-interactive, run interactive once to generate Play App Signing / keystore via EAS.

Expected: Build finished; AAB artifact URL printed.

- [ ] **Step 6: Commit non-secret files**

```bash
git add mobile/eas.json mobile/app.json mobile/package.json mobile/.gitignore
git commit -m "chore(eas): production AAB profile and submit config"
```

**Do not** commit `play-service-account.json`.

---

### Task 9: 스토어 리스팅 문서 + Data Safety + 체크리스트

**Files:**
- Create: `mobile/store/listing-ko.md`
- Create: `mobile/store/listing-en.md`
- Create: `mobile/store/listing-ja.md`
- Create: `mobile/store/data-safety.md`
- Create: `mobile/store/play-checklist.md`

- [ ] **Step 1: Write listings (no widget claims)**

Each file structure:

```markdown
# Sealcard — Play listing (KO)

## App name
Sealcard

## Short description
사진을 밀봉하고, 시리즈 바인더에 꽂습니다.

## Full description
... (spec §6.2 skeleton; mention camera, local-only, no account;
exhibit/share/wallpaper save only if true; NO home widget claim)

## Privacy
https://hwemo-chung.github.io/sealcard-privacy.html
```

JA short: `写真を封じて、シリーズのバインダーに残します。`  
EN short: `Seal a photo. Keep it in a series binder.`

- [ ] **Step 2: data-safety.md**

```markdown
# Data safety answers (draft for Play Console)

- Does the app collect personal data? **No**
- Data shared with third parties? **No**
- Data encrypted in transit? **N/A — no transmission**
- Can users request deletion? **Uninstall app / destroy cards removes on-device data**
- Sensitive permissions: CAMERA (core), Photos write (optional save)
- Ads / analytics / crash SDKs: **None**
```

- [ ] **Step 3: play-checklist.md**

Numbered steps:

1. Replace SUPPORT_EMAIL in config + privacy page  
2. Play Console → Create app Sealcard  
3. Create service account + JSON → `mobile/play-service-account.json` (gitignored)  
4. Link Play app to EAS  
5. `eas submit` → internal track  
6. Add license testers (own Gmail)  
7. Install from internal testing link · seal 1 card · switch language  
8. Fill store listing 3 languages from `listing-*.md`  
9. Upload graphics from `store/assets/`  
10. Content rating questionnaire  
11. Data safety from `data-safety.md`  
12. Countries: all  
13. Promote internal release → production (after QA)  
14. Staged rollout optional 20%  

- [ ] **Step 4: Commit**

```bash
git add mobile/store
git commit -m "docs(store): Play listings, data safety, submit checklist"
```

---

### Task 10: 스토어 그래픽 에셋

**Files:**
- Create: `mobile/store/assets/feature-graphic-1024x500.png`
- Create: `mobile/store/assets/icon-512.png` (export from `assets/icon.png`)
- Create: `mobile/store/assets/screenshots/` (min 2 PNGs)

- [ ] **Step 1: Icon 512**

```bash
cd mobile
# macOS sips example — if icon already 1024, resize:
sips -z 512 512 assets/icon.png --out store/assets/icon-512.png
```

Verify 512×512.

- [ ] **Step 2: Feature graphic**

Create 1024×500 dark (`#0F0F0F`) image with wordmark **Sealcard** and one card visual. Options:

- Design tool / Figma export, or  
- Simple script (ImageMagick/Pillow) if available, or  
- Generate via project image tooling if available  

Must not look like game gacha. No “AI” text.

- [ ] **Step 3: Screenshots**

```bash
# Emulator or device after i18n:
# Capture: binders list, camera (or permission-safe), preview, binder grid
# Save as store/assets/screenshots/01-binders.png etc.
```

Minimum 2 phone screenshots. Prefer EN or KO consistent chrome.

- [ ] **Step 4: Commit binary assets**

```bash
git add mobile/store/assets
git commit -m "assets(store): icon, feature graphic, and screenshots for Play"
```

---

### Task 11: Play Internal submit + 실기 검증

**Files:** none (ops); update checklist boxes in `play-checklist.md` as done

- [ ] **Step 0: Gate — SUPPORT_EMAIL real**

```bash
rg "REPLACE_BEFORE_SUBMIT" mobile/src/config.ts && exit 1 || true
```

Must be real email matching privacy page.

- [ ] **Step 1: Place service account JSON**

Path: `mobile/play-service-account.json` (gitignored). Play Console → Setup → API access.

- [ ] **Step 2: Submit to internal**

```bash
cd mobile
npx eas-cli submit --platform android --profile production --latest
```

Expected: processing on Play; internal track has release.

- [ ] **Step 3: Device QA**

| Check | Pass? |
|-------|-------|
| Install from internal link | |
| Camera allow → seal 1 card | |
| Binder shows card | |
| Language ko/ja/en | |
| Privacy link opens live policy | |
| Share or wallpaper path (if used) | |
| No crash | |

- [ ] **Step 4: Commit checklist progress only if markdown updated**

```bash
git add mobile/store/play-checklist.md
git commit -m "docs(store): mark internal testing QA progress"
```

---

### Task 12: Production 승격

- [ ] **Step 1: Console completeness**

All of: store listing 3 langs, graphics, data safety, content rating, privacy URL, target audience, news app/covid declarations as applicable (No).

- [ ] **Step 2: Promote**

Play Console → Internal testing release → Promote release → Production (or create production release from same AAB).

Optional: staged 20% rollout.

- [ ] **Step 3: Final verification**

- Public or pending-publication status noted  
- `https://play.google.com/store/apps/details?id=app.sealcard.mobile` when live  

- [ ] **Step 4: Commit release notes in repo**

Create `mobile/store/RELEASE.md`:

```markdown
# 1.0.0
- First Play release
- ko/ja/en UI
- Local seal + binder loop
- Privacy: https://hwemo-chung.github.io/sealcard-privacy.html
```

```bash
git add mobile/store/RELEASE.md
git commit -m "docs(store): record 1.0.0 Play production release"
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| C + Internal→Production | 11, 12 |
| Sealcard / package fixed | Global + 6 |
| i18n ko/ja/en system default | 1–5 |
| EAS AAB + Submit | 8, 11 |
| Privacy github.io URL | 7, 4 |
| Store listing 3 langs | 9 |
| Data Safety | 9 |
| Graphics | 10 |
| Settings version/privacy/contact | 4 |
| No widget store claims | 9 catalog + present strings Task 1 |
| SUPPORT_EMAIL | config Task 1, gate Task 11 |
| No android/ commit | Global + eas cloud |
| Key parity test | Task 1 |

## Placeholder scan

- `REPLACE_AFTER_EAS_INIT` / `REPLACE_EXPO_USERNAME` / `REPLACE_BEFORE_SUBMIT@example.com` — intentional **ops placeholders**; Task 8/11 gate removes them. Not “implement later” scope holes.

## Type consistency

- `LocalePreference` / `AppLocale` defined once; Settings.locale; I18nProvider preference; resolveEffectiveLocale — same names across Tasks 1–4.
- `t(key, { count, name, id, template, version })` matches catalog `%{…}` placeholders.
