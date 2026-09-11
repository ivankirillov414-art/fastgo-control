# FastGo — Google Sheets + Drive backend

Accepted production mechanics:

- Google Sheets stores FastGo business data.
- Google Drive stores photos, documents and backups.
- Supabase remains only for login/staff authorization and as the authenticated proxy to Apps Script.
- Stock/sale/order mutations in Apps Script are serialized with `LockService`.

Working spreadsheet: `1f-uEIV8NXKmz5hBoaxKZBXVh55AjexZlH9SIYQIU_vo`.
Drive project root: `15zofu7aBm4yn5GJ01CfRlKAu7qG8AQYE`.

The current deployable `Code.gs`, `appsscript.json`, `SETUP.txt` and Edge proxy source are stored in Google Drive under `FastGo — Сервис и склад/05 — Backend API`. Secrets are never stored in this repository.

Cutover is intentionally blocked until the Apps Script web app has been deployed and `FASTGO_SHEETS_API_URL` / `FASTGO_SHEETS_API_SECRET` are set for the Supabase Edge Function. The old Supabase business tables and legacy private bucket remain as rollback until the 20 legacy files listed in the Sheet tab `Файлы миграции` have been physically copied and verified.
