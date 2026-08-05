# Sealcard Mobile (Android-first)

TypeScript + **React Native (Expo)** — 네이티브 모듈(CameraX 계열 / 파일 시스템)을 쓰되 앱 로직은 TS로 유지.

## 왜 Expo + TS

| 요구 | 선택 |
|------|------|
| 타입스크립트 | 앱 전체 TS |
| 네이티브 | `expo-camera`, `expo-file-system`, `react-native-view-shot` |
| 효율 | Kotlin Compose 풀스택 대비 루프 검증 속도 우선 (PRD M1–M3) |
| 서버 | 없음 · 로컬 only |

순수 Kotlin 네이티브가 필요하면 루프 검증 후 포팅. 지금 병목은 네이티브 성능이 아니라 **제품 루프**.

## 루프

`바인더 목록 → 밀봉+ → 촬영 → 미리보기 → 확인 → 바인더 선택 → 그리드`

밀봉 후 **이미지·날짜·템플릿 수정 API/UI 없음**. 이동·파기만 허용.

## 실행

```bash
cd mobile
npm install
npm run android   # 에뮬레이터/기기
# 또는
npx expo start
```

카메라 권한 필요. 시뮬레이터는 웹/권한 제한 가능 → 실기 권장.

## 구조

```
src/
  domain/     types, templates, dates, id
  storage/    repository (AsyncStorage meta + 파일 정본)
  screens/    8화면 이내
  components/ CardFace, PrimaryButton
  navigation/ 단순 상태 머신 (App.tsx)
```

## PRD

`../docs/PRD.md`
