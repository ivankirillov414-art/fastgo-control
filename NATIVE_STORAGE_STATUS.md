# FastGo native operational store — 2026-09-13

Owner authorized Postgres as the operational source and Google as an asynchronous replica.
Production remains in `workshop_backend_config.storage_mode = google` until the replica
worker is installed and the final cutover checks pass. Do not advertise native mode as live.

## Prepared and verified

- Production gateway `fastgo-workshop-api` v17 and authenticated mirror transport
  `fastgo-google-mirror` v1 are deployed; deployed source matches this repository.
  Public gateway reports Google mode; anonymous business reads and mirror claims return 401.
- `workshop_native_*` server-only tables, atomic commit RPC, idempotency receipts,
  optimistic global version check, and durable ordered Google outbox are installed.
- 236 rows from 18 Google tabs imported into an isolated staging store, preserving
  row numbers, identifiers, original business values and all existing file links.
- Imported: 81 products, quantity 168, 2 repairs, 5 storage records, 7 clients,
  7 intake records, 19 stock movements, 18 services, 17 categories, 20 legacy files,
  one private product photo, nine existing idempotency receipts. No sales/payments.
- Zero missing intake references, zero new native tables without RLS; anonymous and
  authenticated browser roles cannot access native tables or commit RPC directly.
- Real Postgres rollback-only verification passed: data + outbox atomicity, receipt replay,
  competing version rejection, rollback after a mid-batch failure, and 5-minute fence
  after uncertain Google writes. All test data and mode changes were rolled back.
- Native engine tests pass with Google deliberately unavailable: primary screens,
  repair/parts/approval/payment/issue, two actors selling the last unit, lost responses,
  mechanic access restrictions and private product photo upload/view.

## Replica worker and remaining cutover

`google-apps-script/NativeSync.gs` is prepared for the existing Apps Script project:
https://script.google.com/home/projects/1veLA4VEcDWNzsxlr51E4VdES-fpDy7dbiO12apikOIcKo7bKMm0KphPh/edit

It uses the existing FASTGO_API_SECRET property and existing Sheets/UrlFetch/trigger scopes.
No password, new token, or public file permission is needed. `installNativeSync` verifies
Google against the staged snapshot and installs exactly one minute trigger.
`syncNativeChanges` applies complete row changes in a Sheets atomic batch under the existing
script lock, then acknowledges the lease. Lost/uncertain results retain the oldest job with a
5-minute fence. Later jobs cannot overtake it. It never replays business commands.

The cloud browser still times out on CDP tab discovery, so the Google script has NOT been
installed by the agent and no successful scheduled mirror round trip is claimed.

After installation:
1. Inspect mirror_seen_at/mirror_verified_at and confirm the trigger is present.
2. Briefly pause new writes (`storage_mode=paused`), drain old in-flight Google requests,
   re-read the source; if changed, re-bootstrap staging and re-run verification.
3. Require a successful real worker round trip, then atomically set native_state.mode=active
   and backend_config.storage_mode=postgres. Never activate while the worker is missing.
4. Verify native catalog/list reads through the owner session, perform the test lifecycle
   with existing QA records only, observe queue drain and Google values after sync.
5. Keep former legacy inventory triggers enabled. Old bots must not write to an independent stock.

Old Google/Drive files remain private. Newly uploaded native files go into the private
`fastgo-workshop-private` bucket; Google mirrors their references. Viewing original Drive
binaries and the existing daily backup status can still involve Google; normal business
reads/writes in native mode do not.
