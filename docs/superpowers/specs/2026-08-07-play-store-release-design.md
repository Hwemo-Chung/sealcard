# Sealcard — Google Play 실배포 설계

| 항목 | 값 |
|------|-----|
| 상태 | Approved (대화 설계 승인 2026-08-07) |
| 날짜 | 2026-08-07 |
| 목표 | Play Store **실제 공개** (Internal testing → Production) |
| 플랫폼 | Android only |
| 관련 | [PRD](../../../PRD.md), `mobile/` (Expo SDK 57) |

---

## 1. 완료 정의 (Done)

1. **Internal testing**: production 서명 **AAB**가 Play internal track에 게시되고, 본인 기기에 설치 후 **밀봉 1회** 가능.
2. **Production 승격 준비**: Data Safety·콘텐츠 등급·한·일·영 리스팅·정책 URL·스크린샷 최소셋이 Console에 입력 가능한 상태. Internal 검증 통과 후 production 트랙 제출.
3. **식별자 고정**: 표시명 `Sealcard`, package `app.sealcard.mobile`, versionName `1.0.0` + versionCode 증가 규칙.
4. **앱 UI i18n**: ko / ja / en, 기본 `system` (미지원 → en).

---

## 2. 확정 결정

| # | 주제 | 결정 |
|---|------|------|
| D1 | 출시 범위 | **C**: 기술 + 스토어 에셋 + 실제 제출·공개 |
| D2 | 트랙 | **D**: Internal testing → 검증 후 Production |
| D3 | 브랜드 | 표시명 **Sealcard** (3시장 동일). package **`app.sealcard.mobile`** 유지 |
| D4 | 로컬라이즈 | 앱 UI · Play 리스팅 · 개인정보처리방침 모두 **ko / ja / en** |
| D5 | 로케일 기본 | Settings `locale: 'system'` · 기기 `ko*`→ko, `ja*`→ja, else→en |
| D6 | 빌드·제출 | **EAS Build** (AAB) + **EAS Submit** |
| D7 | 정책 URL | `https://hwemo-chung.github.io/sealcard-privacy.html` |
| D8 | 정책 호스팅 | 레포 `01_deployable/Hwemo-Chung.github.io` (기존 Pages 사이트) |
| D9 | 가격 | 무료 · IAP 없음 · 광고·분석 SDK 없음 |
| D10 | iOS | 비범위 |

### 네이밍 전략

- 스토어 앱 이름: 전 지역 `Sealcard`.
- 짧은 설명(부제)만 언어 분기.
- JA에서 Seal≈シール(스티커) 오해 → 부제·긴 설명에 **「封じて」** 로 봉인 의미 고정.

| 언어 | 짧은 설명 (초안) |
|------|------------------|
| KO | 사진을 밀봉하고, 시리즈 바인더에 꽂습니다. |
| JA | 写真を封じて、シリーズのバインダーに残します。 |
| EN | Seal a photo. Keep it in a series binder. |

---

## 3. 범위

### 3.1 포함

| 영역 | 내용 |
|------|------|
| i18n | `i18n-js` + `expo-localization`; 전 유저-facing 문자열; 설정 언어 선택 |
| Expo/EAS | `eas.json`, `app.json` (versionCode, splash, projectId), production AAB |
| 제출 | EAS Submit → Internal → (검증 후) Production |
| 법적 | `sealcard-privacy.html` (ko/ja/en), sitemap 갱신 |
| 앱 설정 | 버전, 정책 링크, 문의 mailto, 언어 |
| 스토어 메타 | 3언어 short/full description, Data Safety·등급 가이드 |
| 그래픽 | 아이콘 512, Feature Graphic 1024×500, 폰 스크린샷 ≥2 |
| 문서 | 제출 체크리스트 (자격 증명·Console 수동 단계) |

### 3.2 제외

- iOS / App Store
- 계정·클라우드·광고·IAP·분석 SDK
- **네이티브 홈 위젯** 신규 구현 (미실장 시 스토어에 “홈 위젯” 과장 금지; 인앱 미리보기 유지 가능)
- package / 앱 표시명 변경
- PRD Step 2 금지 기능 재도입
- RTL, 4번째 언어, 원격 문구 서버
- 로컬 `android/` 디렉터리 커밋 (EAS cloud prebuild)

### 3.3 사용자 필수 개입 (에이전트 단독 불가)

1. `eas login` / Expo project 소유 확인  
2. Play Console 앱 생성  
3. Google Play **서비스 계정** JSON → EAS Submit 연결  
4. Internal 테스터 본인 등록  
5. Production 승격 최종 확인 클릭  

---

## 4. 아키텍처

### 4.1 파이프라인

```
sealcard/mobile (Expo managed)
        │  eas build --platform android --profile production
        ▼
   EAS cloud prebuild + sign → production.aab
        │
        ├─ eas submit → Play Internal testing
        │                    │ 실기 밀봉 1회
        └────────────────────┴─ promote → Production

정책 (별 레포)
  Hwemo-Chung.github.io/sealcard-privacy.html
  ← Play Console + 인앱 설정 동일 URL
```

### 4.2 레포 경계

| 레포 | 역할 |
|------|------|
| `03_planning/sealcard` | 앱, EAS, 스토어 카피·에셋·체크리스트 |
| `01_deployable/Hwemo-Chung.github.io` | 정책 HTML + sitemap만 |

### 4.3 sealcard 파일 계획

| 경로 | 역할 |
|------|------|
| `mobile/eas.json` | development / preview / production; production = AAB, version autoIncrement |
| `mobile/app.json` | versionCode 시작값, splash, `extra.eas.projectId`, permission 문구 |
| `mobile/src/i18n/` | `index.ts`, `types.ts`, `locales/{en,ko,ja}.ts` |
| `mobile/src/domain/types.ts` | `Settings.locale: 'system' \| 'ko' \| 'ja' \| 'en'` |
| `mobile/src/screens/*.tsx` 등 | 하드코딩 문자열 → `t('…')` |
| `mobile/src/screens/SettingsScreen.tsx` | 언어, 버전, 정책, 문의 |
| `mobile/store/` 또는 `docs/store/` | 리스팅 3언어, Data Safety 초안, 체크리스트 |
| `mobile/store/assets/` | feature graphic, screenshots |
| `mobile/package.json` | i18n deps, `build:android` / `submit:android` 스크립트 |

### 4.4 github.io 파일 계획

| 경로 | 역할 |
|------|------|
| `sealcard-privacy.html` | `#ko` / `#ja` / `#en` (where-privacy 패턴) |
| `sitemap.xml` | URL 추가 |

**고정 URL:** `https://hwemo-chung.github.io/sealcard-privacy.html`

### 4.5 데이터·권한 (스토어·정책 일치)

| 권한/데이터 | 용도 | 서버 전송 |
|-------------|------|-----------|
| CAMERA | 밀봉 촬영 | 없음 |
| Media library (저장 시) | 전시 이미지 갤러리 저장 | 없음 |
| 로컬 파일 + AsyncStorage | 카드 정본·메타·설정 | 없음 |
| 시스템 공유 시트 | 사용자 선택 대상 | 앱 중계 서버 없음 |

→ Data Safety: **수집·공유 없음**. 광고·분석 SDK 없음.

### 4.6 버전 규칙

| 필드 | 규칙 |
|------|------|
| versionName | 첫 공개 `1.0.0` |
| versionCode | EAS `autoIncrement` (시작 1) |
| Internal→Production | 동일 AAB 승격 가능; 핫픽스만 code++ |

### 4.7 자격 증명

- Play 서비스 계정 JSON·keystore: **레포 커밋 금지**
- `.gitignore` 확인; 체크리스트에 로컬 경로·`eas credentials`만 기록

### 4.8 실패·롤백

| 상황 | 대응 |
|------|------|
| Internal 크래시 | Production 승격 금지; 수정 후 versionCode++ 재빌드 |
| 정책/권한 거절 | Data Safety·문구 수정 후 재제출 |
| 잘못된 빌드 (공개 전) | Internal에만 유지 |
| 공개 후 긴급 | staged rollout 축소 또는 비활성화 (체크리스트) |

---

## 5. i18n 상세

### 5.1 스택

- `expo-localization` — 기기 로케일
- `i18n-js` — 카탈로그·`t()`
- 전역: locale resolve + Settings 오버라이드; 변경 시 앱 리렌더 (간단한 locale version / context)

### 5.2 카탈로그

```
mobile/src/i18n/
  index.ts
  types.ts          // 키 유니온 또는 en 키 기준 타입
  locales/
    en.ts           // source of truth for keys
    ko.ts
    ja.ts
```

- 적용: 화면, 모달, 토스트, 빈 상태, a11y 라벨, 설정 행
- 미적용: templateId, 파일 경로, package, 내부 로그
- 규칙: **새 문자열 = en/ko/ja 동시**
- `UNCATEGORIZED_LABEL` 등 도메인 상수 → i18n 키로 이전
- 날짜 `dateFormatId` (`dot` / `ko`) 유지; 형식 라벨만 번역. 로케일별 날짜 프리셋 추가는 비범위

### 5.3 Settings

```ts
locale: 'system' | 'ko' | 'ja' | 'en'  // default 'system'
```

- AsyncStorage (기존 repository)
- UI: 시스템 따름 / 한국어 / 日本語 / English

### 5.4 시스템 권한 다이얼로그

- `app.json` / 플러그인 시스템 권한 문자열: **한국어 1벌 유지** (현 상태). OS 다이얼로그 다국어는 비범위.
- 인앱 카메라·저장 진입 전 고지·거부 안내 카피: **i18n 적용 (ko/ja/en)**.

### 5.5 앱 이름

- 런타임·스토어 표시명: **Sealcard** 번역하지 않음.

---

## 6. 스토어 · 정책 · 인앱

### 6.1 Console

| 항목 | 값 |
|------|-----|
| 카테고리 | Photography |
| 기본 언어 | 한국어 권장 + EN/JA 번역 추가 |
| 국가 | 기본 전체 국가 |
| 연락 이메일 | 정책·Console·인앱 동일. 상수 `SUPPORT_EMAIL` 1곳. **구현 시작 전 사용자 제공값 고정** |
| 정책 URL | 위 D7 |
| 타깃 | 아동 전용 앱 아님; 등급 설문 결과 따름 (가이드 문서화) |

### 6.2 긴 설명 골격 (3언어 동일)

1. 가치: 찍고 → 밀봉(수정 불가) → 바인더  
2. 기능: 템플릿·날짜, 로컬 보관, 실제 포함된 전시/공유/배경만  
3. 비기능: 계정·클라우드·피드·광고 없음  
4. 권한: 카메라=촬영, 사진 저장=사용자 저장 시에만  
5. 정책 링크  

**금지 카피 (PRD):** 마법, AI, 해금, 희귀, SR, 피드, 스토리 자랑.  
**위젯:** 네이티브 미실장이면 스토어·스크린샷에 “홈 위젯” 주장 금지.

### 6.3 그래픽

| 에셋 | 규격 |
|------|------|
| 아이콘 | 512×512 (`assets/icon.png` 검증) |
| Feature Graphic | 1024×500 신규 |
| 스크린샷 | 폰 최소 2, 권장 4–6 (바인더, 촬영, 미리보기, 그리드/전시) |
| 태블릿 | 스킵 |

### 6.4 개인정보처리방침 필수 섹션

1. 요약: 로컬 only, 서버·계정·광고·분석 없음  
2. 사진: 촬영·정본 앱 저장소·밀봉 후 편집 경로 없음·파기  
3. 선택 갤러리 저장  
4. OS 공유 시트  
5. 수집 없음  
6. 권한 표  
7. 아동/연령  
8. 문의·최종 업데이트  
9. 변경 고지  

패턴 레퍼런스: 동 사이트 `where-privacy.html`, `picbatch-privacy.html`.

### 6.5 Data Safety (초안 방향)

- 수집·공유: 없음  
- 전송 중 암호화: N/A (전송 없음)  
- 삭제: 앱 삭제 및 카드 파기로 기기에서 제거  

### 6.6 인앱 설정 항목

- 기본 프레임 / 날짜 형식 (기존)  
- **언어**  
- **앱 버전** (versionName; versionCode 가능 시)  
- **개인정보처리방침** → `Linking.openURL`  
- **문의** → `mailto:`  
- 홈 위젯: 인앱 포인터·미리보기 UI는 코드에 있으면 유지. **Play 리스팅·스크린샷·짧은/긴 설명에 네이티브 홈 위젯 제공 주장 금지** (네이티브 위젯 실장 전). 설정 힌트 문구는 “앱 내 미리보기/대상 지정” 수준으로 i18n 정합

---

## 7. 구현 순서

| 단계 | 작업 | 완료 기준 |
|------|------|-----------|
| P0 | i18n + Settings.locale + 전 화면 `t()` | ko/ja/en 전환, 유저 문자열 하드코딩 0 |
| P1 | `app.json` 출시 필드 | `expo config` 오류 없음 |
| P2 | EAS 연결 + production AAB 1회 | EAS 아티팩트 존재 |
| P3 | github.io 정책 + sitemap | HTTPS 3언어 확인 |
| P4 | 설정: 버전·정책·문의 | 실기 동작 |
| P5 | `docs/store` 또는 `mobile/store` 메타 | Console 복붙 가능 |
| P6 | 스토어 그래픽 | `store/assets/` |
| P7 | Play 앱 + 서비스 계정 + submit → **Internal** | 설치·밀봉 1회 |
| P8 | Internal OK → **Production** | 심사 제출/게시 |

P0을 P2 앞에 두는 이유: 스크린샷·검증이 3언어 앱 기준.

---

## 8. 검증 게이트

| 게이트 | 방법 |
|--------|------|
| 타입 | `npm run typecheck` |
| i18n 키 | en 키 ⊆ ko·ja (스크립트 또는 수동 diff) |
| 코어 루프 | 촬영→밀봉→바인더; 최소 ko+en, 권장 3언어 |
| 권한 | 카메라·저장 거부/허용 |
| 정책 URL | 설정 링크·브라우저 200 |
| AAB | EAS production 성공, Internal 설치 |
| 과장 카피 | 미실장 위젯 등 스토어 문구 없음 |

**완료 선언:** 위 게이트 증거 없이 “배포 완료” 금지.

---

## 9. 리스크

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| i18n 키 누락 | 중 | en 기준 키 검사 |
| JA シール 오해 | 중 | 부제·설명 「封じて」 |
| 자격 증명 지연 | 중 | P7 전 체크리스트; 선행 단계까지 완료 보고 |
| 권한 vs Data Safety 불일치 | 높음 | 단일 표 공유 |
| 범위 크리프 | 높음 | §3.2 유지 |
| github.io 미배포 | 중 | push 후 curl |
| PRD M4 전 Play 금지 | 참고 | 본 문서는 사용자 명시 요청(C)으로 게이트 재오픈 |

---

## 10. 접근 비교 (채택)

| 접근 | 요약 | 판정 |
|------|------|------|
| **1. EAS 전부** | Build AAB + Submit | **채택** |
| 2. 로컬 prebuild 수동 | keystore 직접 | 비채택 |
| 3. APK dogfood only | 스토어 연기 | 목표 C와 충돌, 기각 |

---

## 11. 변경 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| 1.0 | 2026-08-07 | 초안. C+D, Sealcard, i18n system, EAS, github.io 정책. 대화 설계 승인 반영 |
