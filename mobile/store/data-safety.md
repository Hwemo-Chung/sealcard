# Data safety answers (draft for Play Console)

Answers for Google Play Console → App content → Data safety.
Align with live privacy policy: https://hwemo-chung.github.io/sealcard-privacy.html

## Summary

| Question | Answer |
|----------|--------|
| Does the app collect personal data? | **No** |
| Data shared with third parties? | **No** |
| Data encrypted in transit? | **N/A — no transmission** |
| Can users request deletion? | **Uninstall app / destroy cards removes on-device data** |
| Ads / analytics / crash SDKs | **None** |
| Account required? | **No** |
| Cloud / backend servers | **None** |

## Sensitive permissions

| Permission | Purpose | Required? |
|------------|---------|-----------|
| CAMERA | Capture photos to seal as cards | Yes (core) |
| Photos / media write | Optional save for wallpaper path | Optional (user-initiated save only) |

## Data types (Play form)

- **Photos and videos:** Processed and stored **on-device only**. Not collected by the developer, not uploaded, not shared with third parties.
- **Location / contacts / financial / health / messages / files / app activity / web browsing / app info and performance / device or other IDs:** Not collected.

## User controls

- Destroy individual sealed cards in-app → removes that on-device card data.
- Uninstall the app → removes remaining on-device app storage.
- No developer-held copy exists to delete remotely.

## SDKs and third parties

- No ad SDKs
- No analytics SDKs
- No crash-reporting SDKs that transmit data
- Share uses the OS share sheet only (user chooses the destination app)

## Notes for Console operators

- Select **No** for data collection if the form allows “on-device only, not collected by developer.”
- If forced to declare photo handling: purpose = App functionality; collection = on device; sharing = no; encryption in transit = N/A or not applicable.
