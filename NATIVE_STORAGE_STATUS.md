# FastGo native operational store — 2026-09-13

Owner authorized Postgres as the operational source and Google as an asynchronous replica.
Production switched to `workshop_backend_config.storage_mode = postgres` and
`workshop_native_state.mode = active` on 2026-09-13 at 11:18:03 UTC (16:18 Orenburg).
Primary business reads and writes now use Postgres; Google is an asynchronous replica.

## Prepared and verified

- Production gateway `fastgo-workshop-api` v17 and authenticated mirror transport
  `fastgo-google-mirror` v1 are deployed; deployed source matches this repository.
  All three public gateway health endpoints report `POSTGRES_GOOGLE_MIRROR` after cutover;
  anonymous business reads and mirror claims remain denied.
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

The owner installed the prepared script and ran `installNativeSync` from Safari.
Google/server snapshot equality was confirmed at 11:13:26 UTC. The minute trigger
produced independent subsequent heartbeats, including 11:18:34 UTC after cutover.

## Cutover evidence

1. Writes were paused at 11:15:33 UTC. All 18 source tabs were re-read: the 236 rows,
   headers and original values matched staging. The Google operation journal was
   checked again after in-flight requests had drained; it still contained nine receipts.
2. `scripts/native-cutover-probe.sql` queued an explicitly labelled system migration
   probe. It rewrote only the existing QA product barcode with exactly the same value.
   No employee identity was used and no order, payment or stock quantity was changed.
3. The installed Google trigger claimed outbox job 2 and acknowledged it at 11:17:36 UTC,
   on its first attempt, with no error. Connector readback confirmed the QA row unchanged.
4. After that real transport round trip, one transaction enabled the native store and
   switched all workshop/repair/storage gateways. The transport probe's system receipt
   is intentionally internal; it is not a customer operation in the Google journal.
5. Post-cutover: 81 products, total stock 168, two repairs, five storage orders,
   no pending replica jobs. Public gateway responses confirm the new backend.

The authenticated owner interface has not been rechecked after cutover because the
agent's cloud browser remains unavailable. Earlier domain tests and real Postgres
transaction tests passed; those are not a substitute for a live phone/device check.
The user should refresh the existing application to observe the new loading behavior.

Do not switch back to Google blindly after new native writes: first pause writes and
confirm the outbox is drained and Google matches the current primary data. Keep the
former legacy inventory triggers enabled; old bots must not maintain independent stock.

Old Google/Drive files remain private. Newly uploaded native files go into the private
`fastgo-workshop-private` bucket; Google mirrors their references. Viewing original Drive
binaries and the existing daily backup status can still involve Google; normal business
reads/writes in native mode do not.
