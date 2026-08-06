# 프레임 · 전시 벤치마크 (2026-08-06)

수집: 웹 공개 패턴 (Canva Polaroid, PoPo Frame, Vecteezy/PNGTree 투명 오버레이, Gallery wall black+matte 제품 패턴, Dribbble photocard 태그).  
목적: Sealcard 템플릿 오버레이 + §14 전시 스테이지 바닥 품질.

## A. 밀봉 프레임 패턴 (카드 정본 bake)

| 클러스터 | 공통 형태 | 벤치 출처 요지 | Sealcard 매핑 |
|----------|-----------|----------------|---------------|
| Instant / Polaroid | 상·좌·우 얇은 여백, **하단 두꺼운 날짜 밴드**, 미색 카드 | Canva polaroid, PoPo Frame, blank polaroid PNG | `polaroid`, `polaroid_cream`, `polaroid_black` |
| Thin white / minimal | 균일 얇은 흰 테두리, 날짜 우측·소형 | social post template | `minimal` |
| Gallery matte | **넓은 매트**, 사진 비중 ↓, 인쇄물 감성 | museum matte / wide mat frames | `matte_gallery`, `frame_dark` |
| Ornate wood/gold | 이중 림, 금/우드 톤, 안쪽 세선 | stock “realistic frame” | `frame_gold`, `frame_wood` |
| Film / ticket / postage | 스프로켓·절취선·톱니 가장자리 | filter apps, clipart overlays | `film_strip`, `ticket`, `postage` |
| Soft / neon / glass | 큰 radius, 발광 보더, 반투명 림 | 인스타 프레임 앱 계열 | `soft_round`, `neon`, `glass*` |

**픽커 UX 함의**: 15종을 한 줄로 나열하면 실패. 카테고리 칩으로 클러스터 노출.

**에셋 형식**: 투명 PNG 오버레이(중앙 포토 홀 alpha=0) + SVG 소스.  
경로: `mobile/assets/frames/{templateId}.{svg,png}`

## B. 전시 스테이지 (정본 위 제시 — 밀봉 템플릿과 분리)

| 규칙 | 벤치 | 채택 |
|------|------|------|
| 한 장 집중 + 큰 벽 여백 | gallery wall 60–75% art rule, 화이트/웜 벽 | 벽 톤 `#E8E4DC`–`#D4CFC4`, 중앙 1작품 |
| 얇은 블랙 프레임 + 넓은 흰 매트 | Classic Wide black + white mat 제품군 | 프리셋 1종만 (E4) |
| 월 라벨 | 작품 아래 제목·날짜 | 바인더명 + sealedAt |
| 상단 조명 힌트 | spot soft, 파티클 없음 | 상단 그라데이션 소프트 1겹 |
| 이중 액자 금지 | 밀봉 bake 위에 또 화려한 프레임 = slop | 전시 프레임은 **정본 이미지 통째**만 매트 안 |

에셋: `presentation_matte.{svg,png}`

## C. 비채택

- 꽃·보태니컬 장식 폴라 (slop / 필터 앱화)
- 장수 해금 배지, 진행률 12/30
- 위젯 랜덤·오늘의 카드

## D. 산출물

- SVG/PNG 16종 (15 템플릿 + presentation_matte) — PIL 기하 생성 (투명 홀 정밀)
- 앱 연동: 픽커 미니 미리보기 + 전시 렌더러
