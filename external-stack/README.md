# FastGo external production stack

Goal: move FastGo workshop, winter storage, inventory, sales and their files out of the shared Supabase project.

## Target architecture

- **Neon PostgreSQL** — structured FastGo data only.
- **Cloudflare R2** — all photos, signed acts, intake files and inventory photos.
- **Cloudflare Worker** — one private API between the web app, Neon and R2.
- **Supabase Auth (temporary compatibility layer)** — login only during phase 1. No production FastGo rows or files should be stored there after cutover.

Keeping Supabase Auth temporarily avoids forcing every employee to reset credentials while the data and file layer are migrated. It can be removed in phase 2 without another database migration.

## Current source footprint (2026-09-11)

The FastGo workshop/service/storage/inventory PostgreSQL tables together are about **2.2 MB**. The shared private Supabase storage bucket already contains about **74.5 MB in 20 files**. This is why binary files, not relational rows, are the first capacity risk.

## Cutover scope

Phase 1 moves these live domains:

- workshop members and permissions;
- repairs;
- winter storage intakes;
- service price catalog;
- parts/inventory and stock movements;
- workshop payments;
- event/audit history;
- barcode categories;
- cashier sales and sale items;
- legal settings used in workshop documents;
- every file referenced by repair/storage/inventory rows.

Legacy rental/service tables that are not required by the current workshop UI may remain read-only in Supabase until a later archival migration.

## File key convention in R2

Keep existing logical paths so database rows do not need to know the storage provider:

- `workshop/repair/<repair-id>/...`
- `workshop/storage/<storage-id>/...`
- `workshop/parts/<part-id>/...`

The Worker translates these keys to private R2 objects. The browser never receives R2 credentials.

## Migration order

1. Create the Neon project and apply `neon/schema.sql`.
2. Create a private R2 bucket, for example `fastgo-private-files`.
3. Deploy the Worker in `cloudflare/` with Neon/R2 secrets.
4. Copy relational data from Supabase to Neon preserving UUIDs and document numbers.
5. Copy referenced objects from Supabase Storage to R2 preserving logical paths.
6. Run row counts, financial totals, stock totals and missing-file verification.
7. Put the current Supabase FastGo data path into read-only mode.
8. Switch `workshop/core.js` API base to the Worker.
9. Run real employee E2E tests: repair, winter storage, stock receipt, barcode sale, photo upload and issue/return.
10. Only after successful verification remove FastGo files from Supabase Storage.

## Required secrets

Cloudflare Worker secrets/vars:

- `DATABASE_URL` — Neon PostgreSQL connection string.
- `SUPABASE_URL` — temporary auth project URL.
- `SUPABASE_PUBLISHABLE_KEY` — temporary auth publishable key.
- `FILE_TOKEN_SECRET` — random 32+ byte secret used for short-lived private file URLs.
- R2 binding: `FASTGO_FILES`.

Migration-only credentials must **not** be committed to GitHub.

## Safety rules

- Preserve every source UUID during migration.
- Do not delete Supabase source rows during the first cutover.
- Copy files first, verify checksums/size, then switch reads.
- Stock movements and payments are append-only accounting records.
- A cashier sale must be transactional: sale header + items + stock decrement either all commit or all roll back.
