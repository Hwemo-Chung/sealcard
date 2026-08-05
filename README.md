# Sealcard (가칭)

일상 사진을 **날짜 + 템플릿으로 밀봉**하고, **시리즈 바인더**에 꽂아 보관하는 Android-first 앱.

> 생성은 싸다. 제품의 핵심은 판단(밀봉)이다.  
> 벤치 철학: [Taste Labs](https://tastelabs.com/) — kill the slop, raise the floor.

## 문서

| 경로 | 내용 |
|------|------|
| [docs/PRD.md](./docs/PRD.md) | PRD — Musk 5단계 + Taste 벤치 + MVP |
| [mobile/](./mobile/) | **구현** — Expo + TypeScript (네이티브 모듈) |
| [mobile/README.md](./mobile/README.md) | 실행 방법 |

## 상태

- M1–M3 코어 루프 구현 (`mobile/`)
- 스택: TypeScript · React Native (Expo) · 로컬 전용

## 한 줄 루프

`촬영 → 미리보기 → 밀봉 → 바인더 → 그리드`

```bash
cd mobile && npm install && npm run android
```
