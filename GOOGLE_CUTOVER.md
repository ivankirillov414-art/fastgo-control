# FastGo — Google Sheets cutover, 2026-09-12

The live `fastgo-workshop-api` now uses Google Sheets for catalogue, clients, repairs, winter storage, stock movements, sales, payments and legal settings. `fastgo-storage-api` and `fastgo-service-api` forward to that authenticated gateway. There is no automatic fallback writing business records to old Postgres tables.

Supabase remains for staff authentication, role management, the private connection configuration and READ-ONLY access to existing private file references. This is not a complete removal of Supabase. Unrelated rental/Telegram/VK services are not migrated by this release and must not be treated as synchronized writers to Google stock.

Before cutover, 80 products and their barcodes/quantities matched individually; total stock 167, active services 18. Sheets has five winter-storage records and the one migrated legacy repair. A private pre-cutover Google Sheet copy was created in the backups folder. No original business records or photographs were deleted.

Browser sources include inventory scanner/labels/checkout/import, persistent sale retry request IDs, private intake-upload attachment, longer Google request timeout and a Google Sheets backend label. The old release-feed sync cannot overwrite the workshop anymore.

## Verification boundaries
- Real Google catalogue read and per-product comparison to source stock succeeded.
- All three deployed API health endpoints identify GOOGLE_SHEETS_DRIVE and reject unauthenticated data requests.
- 15 mocked gateway regression tests cover routing, credentials, roles, amounts, sale aggregation, revisions and arbitrary-file attachment rejection; core helper tests also run in CI.
- No authenticated production checkout or complete real employee browser flow was performed. Camera/thermal-printer hardware is not verified here.
- Google Apps Script uses a script lock but its multi-sheet changes are NOT SQL transactions. A timeout or partial provider failure requires reconciliation before retry; a lock alone does not provide atomic rollback.

## Known remaining work
- Twenty old storage objects remain in Supabase. Authorized legacy photo viewing is retained; new intake files use private Google Drive folders.
- Product-card photo uploading is temporarily disabled: the existing Apps Script implementation grants anyone-with-link access. Re-enable only after private product-photo storage/reading is implemented; intake photo uploading is separate.
- Google Sheets staff names are a migrated snapshot; Supabase remains the authoritative role directory.
- Daily Apps Script backup-trigger installation was not independently verified; the manually created pre-cutover copy exists.
- Google Drive placement is a technical decision, not certification of compliance with personal-data localization requirements.

## Rollback
Keep the Google table and all new records. Freeze writes first. Do not simply re-enable old Postgres writes after users have created new Google records: export/reconcile the delta first. The pre-cutover spreadsheet copy is a snapshot, not a live mirror.
