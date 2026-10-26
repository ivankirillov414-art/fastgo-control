# FastGo parts card proposals, 2026-10-25

Open `part-card-options.html` to switch between five proposed layouts. These are
review mockups, not a deployed product screen. The preview clips a part from the
user-provided screen photograph using SVG; the source image is unchanged. Its
low resolution is not representative of the original catalogue photograph.
Prices, stock and product compatibility in the mockups are illustrative.

The user selected option 3 (photo on the right). It is now implemented in the shared warehouse card. Each proposed
layout removes the white image surround and offers an enlarged view. Barcode
white quiet zones remain intentional.

Photo loading changes are implemented in `workshop/photo-cache.js`, shared by
the standalone warehouse and unified desktop catalogue. Only the native laptop
bridges enable persistent caching. Pixels are keyed by account, part and photo
path, not by expiring signed URL. Each read still requires an authorized URL
from the existing API; this is a bandwidth optimization, not offline access.
Cache limits: 100 files, 64 MiB, seven days; no account tokens in stored keys.
Uploading a replacement changes the path and therefore the cached version.
Storage failure falls back to normal loading. Individual image cleanup revokes
object URLs; simultaneous requests for the same image share a download.

Validation:

- `node scripts/check-part-photo-cache.cjs`: restart, URL rotation, account and
  path isolation, expiry, refresh, fresh access denial, eviction, quota fallback.
- `node scripts/check-part-photo-cache-native.cjs`: actual hidden Electron with
  the native `fastgo://` secure origin and a separate temporary profile; proves
  persistence after full process restart, without touching installed apps.
- `node scripts/check-warehouse-catalog-browser.cjs`: existing catalogue,
  expired URL recovery, uploads, retry, resume and permission checks.
- `node scripts/preview-part-card-options.cjs`: five screenshots, enlargement,
  small laptop and mobile overflow checks.

These changes have not been published as a Windows installer or verified on
the physical cash laptop. No new version number or rollout is claimed here.