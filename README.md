# Sealcard (가칭)

일상 사진을 **날짜 + 템플릿으로 밀봉**하고, **시리즈 바인더**에 꽂아 보관하는 Android-first 앱.

> 생성은 싸다. 제품의 핵심은 판단(밀봉)이다.  
> 벤치 철학: [Taste Labs](https://tastelabs.com/) — kill the slop, raise the floor.

## 문서

| 경로 | 내용 |
|------|------|
| [docs/PRD.md](./docs/PRD.md) | PRD v0.2 — 코어 + §14 전시·제시 |
| [research/frame-benchmark-2026-08-06.md](./research/frame-benchmark-2026-08-06.md) | 프레임·전시 벤치 |
| [mobile/](./mobile/) | **구현** — Expo + TypeScript |
| [mobile/README.md](./mobile/README.md) | 실행 방법 |
| [mobile/assets/frames/](./mobile/assets/frames/) | 템플릿 SVG + 투명 PNG 오버레이 |

## 상태

- 코어 루프: 촬영 → 미리보기 → 밀봉 → 바인더 그리드
- 전시·제시: `그리드 | 전시` · 이미지 공유 · 배경 저장 · 위젯 대상/미리보기
- 스택: TypeScript · React Native (Expo) · 로컬 전용

## 한 줄 루프

`촬영 → 미리보기 → 밀봉 → 바인더 → 그리드 | 전시`

```bash
cd mobile && npm install && npm run android
```
