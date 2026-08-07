# Sealcard — feature/play-store-release 작업 정리

**기간:** 2026-08-07 ~ 2026-08-08  
**브랜치:** `feature/play-store-release`  
**패키지:** `app.sealcard.mobile`  
**표시 이름:** Sealcard  

---

## 1. 개요

Play Store 실배포 경로(C) 준비와 병행해, 기기 QA 피드백을 반영한 UI/UX·프레임·아이콘·배포 인프라 작업을 진행했다.

---

## 2. 카드 상세 (Card Detail)

- CollectUI Bottom nav 벤치마킹 → **플로팅 pill 액션 바** (`CardActionNav` + `NavIcons`)
  - 공유 · 이동 · 파기 (아이콘-only → 탭 시 라벨 확장)
  - 이동 시 바인더 목록 플라이아웃
- 하단 중복 메타 제거: 날짜 / `바인더 · 템플릿` 문구 삭제 (카드 이미지에 이미 포함)
- `cardDetail.frozen` 안내 문구 제거 (촬영 배너·밀봉 미리보기에만 유지)
- 설정으로 액션 바 **상단/하단** 배치 선택 (`actionNavPosition`)
- 공유는 `PresentActions` ref (`hideButton` + `share()`)로 연결

---

## 3. 바인더

- **촬영 없이 바인더 생성** 가능 (`BindersScreen`)
  - 헤더 «새 바인더», 빈 화면 생성 폼
  - 삭제 후 빈 상태에서도 생성 가능 (기존: 밀봉 플로우만 가능)
- 용어: **「시리즈」→「바인더 / 바인더 제목」** (KO/EN/JA)

---

## 4. 촬영 · 스탬프 옵션

설정 및 촬영 세션 토글:

| 옵션 | 기본 | 설명 |
|------|------|------|
| 날짜 표시 | ON | 카드 날짜 스탬프 |
| 위치 표시 | OFF | GPS 역지오코딩 장소명 (기기 내, `expo-location`) |
| 바인더 제목 표시 | OFF | 밀봉 시 선택한 바인더명 프레임 각인 |
| 액션 바 위치 | 하단 | 카드 상세 pill |

- 위치: `locationLabel.ts` + 권한 문구 (`app.json`)
- 바인더명 ON 시 `PickBinderScreen`에서 최종 재캡처 후 밀봉

---

## 5. 카메라 · 프리뷰 레이아웃

- 퍼센트 여백 제거 → 스테이지 `onLayout` + **사방 5px**만 두고 contain 최대 핏
- 적용: `SealCameraScreen`, `SealPreviewScreen`

---

## 6. 프레임 전수 개량

### 삭제 프레임
- 글라스, 오로라 글라스 (카테고리 `glass` 제거)
- 골드 프레임, 우드 프레임

### 남은 프레임 (11)
폴라로이드 3 · 다크 · **1:1 정사각형(구 미니멀)** · 갤러리 매트 · 필름 · 티켓 · 네온 · 우표 · 소프트 라운드

### 공통 / 피커
- MiniFrame: PNG stretch 제거 → 스타일 기반 미니 카드 (짤림·깨짐 개선)
- 스탬프 다중 줄: 폰트 적응 + dateBand 상향 (겹침 완화)

### 네온
- 파랑/핑크 이중 보더 **동일 stroke + 동심 radius** (코너 오차 수정)

### 우표
- 4면 SVG 원형 천공 (Android View 사각 이슈 회피)
- 원 간격·스캘럽 비율 실물 우표 참고
- 날짜 ON → **원형 소인(포스트마크)** SVG  
  - Magnific «우표도장» 벡터 패턴 (이중 링, 중앙 바, 물결 cancel 곡선)
  - 사진 + 흰 용지 경계에 걸침, **왼쪽** 정렬

### 필름 스트립
- 35mm 스타일 **사각 스프로켓**, 레일 광택
- 상·하 검은 여백 최소화 (헤어라인 게이트)
- 왼쪽 레일: `날짜 · 바인더제목` 세로
- 오른쪽 레일: 위치 세로

### 1:1 정사각형 (minimal)
- 사진 슬롯 강제 1:1 (`cardLayout` 전용 분기)
- 하단 날짜 여백 확대 (사진 비율 유지)
- 표시 이름: «1:1 정사각형»

---

## 7. 앱 아이콘

- 런처 마크 중앙 축소 (원본 대비 **37.5%** — 50% 이후 «지금 기준 75%» 해석 수정)
- `icon` / adaptive foreground·monochrome / favicon 갱신
- (네이티브 mipmap은 `/android` gitignore — 로컬 재빌드 시 반영)

---

## 8. Play Store 배포 준비

| 항목 | 상태 |
|------|------|
| `SUPPORT_EMAIL` | `tolaria@naver.com` |
| 개인정보처리방침 | https://hwemo-chung.github.io/sealcard-privacy.html (라이브) |
| 리스팅 KO/EN/JA · data-safety · checklist | `mobile/store/` |
| EAS 계정 | `hwemochung` |
| EAS 프로젝트 | `@hwemochung/sealcard` |
| projectId | `a1f47fd7-8367-42d1-b12e-3cf045cadba3` |
| Production AAB 빌드 | 제출됨 (`fdda6423-…`, 당시 IN_QUEUE) |
| Play 서비스 계정 JSON | 미배치 (수동/submit 시 필요) |

빌드 로그:  
https://expo.dev/accounts/hwemochung/projects/sealcard/builds/fdda6423-76f1-4fb5-b27a-5c2f661abf53  

---

## 9. 주요 신규/수정 파일

**신규**
- `mobile/src/components/CardActionNav.tsx`
- `mobile/src/components/NavIcons.tsx`
- `mobile/src/domain/locationLabel.ts`
- `docs/CHANGELOG-play-store-release-session.md` (본 문서)

**수정 (대표)**
- `CardFace.tsx`, `TemplatePicker.tsx`, `templates.ts`, `types.ts`
- `SealCameraScreen`, `SealPreviewScreen`, `CardDetailScreen`, `BindersScreen`, `SettingsScreen`, `PickBinderScreen`, `PresentActions`
- `App.tsx`, `app.json`, i18n `en`/`ko`/`ja`
- 아이콘 에셋, `package.json` (`expo-location`)

---

## 10. 남은 일 (배포)

1. EAS AAB `FINISHED` 확인 · 다운로드  
2. Play Console: 앱 생성, 리스팅, 데이터 보안, 등급, 그래픽  
3. `play-service-account.json` 또는 수동 AAB 업로드 → **내부 테스트**  
4. 내부 QA 후 프로덕션 승격  

체크리스트: `mobile/store/play-checklist.md`
