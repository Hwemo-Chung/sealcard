# Play submit checklist — Sealcard

Production path: **EAS login → internal testing → production**.
Do not claim native home widgets in Console copy or screenshots.

## Prerequisites

- [ ] `eas login` (Expo account that owns the project)
- [ ] `eas init` / confirm `app.json` `extra.eas.projectId` and `owner` are real (not placeholders)
- [ ] Replace `SUPPORT_EMAIL` in `mobile/src/config.ts` **and** the privacy page (same address as Play Console contact)
- [ ] Privacy live: https://hwemo-chung.github.io/sealcard-privacy.html
- [ ] Play Console developer account ready

## Numbered steps

1. **Replace SUPPORT_EMAIL** in `mobile/src/config.ts` + privacy HTML so Console / policy / in-app mailto match.
2. **Play Console → Create app** with name **Sealcard** (do not translate the name). Package: `app.sealcard.mobile`.
3. **Create Google Play service account** + download JSON → save as `mobile/play-service-account.json` (gitignored; never commit).
4. **Link Play app to EAS** (submit credentials / service account for package `app.sealcard.mobile`).
5. **`eas login`** if session expired, then production AAB + **`eas submit` → internal track**  
   (`npm run build:android` / `npm run submit:android` or equivalent EAS commands).
6. **Add license testers** (own Gmail) on the internal testing track.
7. **Install from internal testing link** · seal 1 card · switch language (ko / ja / en / system).
8. **Fill store listing** for 3 languages from `listing-ko.md`, `listing-en.md`, `listing-ja.md`  
   (short descriptions exact; no widget / forbidden copy).
9. **Upload graphics** from `store/assets/` (icon 512, feature graphic 1024×500, phone screenshots ≥2).
10. **Content rating** questionnaire (complete and apply).
11. **Data safety** from `data-safety.md` (collect/share: No; no ads/analytics).
12. **Countries:** all (default worldwide).
13. **Promote internal release → production** after QA (only after step 7 pass).
14. **Staged rollout** optional (e.g. 20%), then 100%.

## Copy gates (before publish)

- [ ] App name is **Sealcard** in every locale
- [ ] Short descriptions match design (KO/JA/EN)
- [ ] Full descriptions: no **마법 / AI / 해금 / 희귀 / SR / 피드 / 스토리 자랑**
- [ ] No **native home widget** claims in listing, screenshots, or feature graphic text
- [ ] Privacy URL set in Console and listing
- [ ] Contact email = SUPPORT_EMAIL

## After production

- [ ] Install from Play Store link on a clean device
- [ ] Seal 1 card, open privacy from Settings, confirm mailto
- [ ] Monitor crash / ANR for first 48h; halt staged rollout if critical
