# FastGo Google API reliability upgrade

This directory contains the existing Google backend plus the reliability layer.
No secret values are in source control. Preserve the existing script property
`FASTGO_API_SECRET` and the existing deployment URL.

## Install in the existing FastGo API Apps Script project

1. Replace `Code.gs` and add `Reliability.gs` from this directory.
2. Use `appsscript.json` from this directory. Its scopes are Sheets, Drive,
   outbound requests to the Sheets API and management of this script's triggers.
3. Run `installReliability` once as the script owner. Grant the listed Google
   permissions. It checks API access, creates two journal/photo metadata tabs,
   installs one daily trigger for 03:00 Asia/Yekaterinburg, makes and verifies a
   backup, and restores it to an isolated copy. Production data is not replaced.
4. Update the existing Web App deployment to a new version, preserving URL,
   execution identity and existing audience. Do not create a second writer.
5. The authenticated app health must return `capabilities.atomic_writes=true`
   and `capabilities.private_product_photos=true`. The gateway/UI enable the
   new features only then. Run the authenticated employee acceptance below.

## Guarantees and limitations

- The script stages business writes and commits them through one Sheets
  `spreadsheets.batchUpdate`. It includes the operation receipt, stock, sale,
  movement, payment, order and sequence changes in that same atomic request.
- A script lock serializes all reads and writes through this script. A private
  durable intent blocks subsequent operations after an uncertain network result.
  If the receipt exists, recovery does not replay the write. Otherwise it waits
  300 seconds before retrying the deterministic packet, exceeding Google's
  documented 180-second processing limit. No later operation can run first.
- Operation IDs are tied to actor, action and request fingerprint. A changed
  request cannot use an existing receipt. Browser hashes/IDs survive reloads;
  sale carts are kept per employee, with edits locked after an uncertain result.
- Direct manual edits to Google business sheets bypass the application lock.
  Use the app for stock, sales and orders; Sheets is for read-only inspection.
  A second Apps Script deployment/project with old code must not write this file.
- Drive files are created before their metadata transaction. An interrupted
  upload can leave an unreferenced private file, but cannot grant public access
  or create a half-written order/stock operation. Source files are not deleted.
- Backups copy and verify the spreadsheet, including file references. They do
  not duplicate every photo's binary contents; retain the private Drive files.
  Daily trigger installation is distinct from observing a scheduled execution.
- Google editors/owners can access the files according to the existing account
  permissions. Private app viewing checks staff access and record ownership.

## Old photo migration

After the Google deployment, the owner opens **Склад → Копии и файлы →
Перенести и проверить файлы**. The Edge Function reads only the objects in the
existing migration manifest, checks size/SHA-256, and sends them to the private
Drive migration handler. Drive bytes are re-read and hashed before the manifest
is marked complete. Retrying an object does not duplicate the manifest entry.
Four of the 20 original objects have no linked intake; preserve them unassigned.
Supabase originals are intentionally retained pending acceptance.

## Acceptance still requiring live access or hardware

- Sign in with an actual employee account and complete intake → repair →
  agreement/QA → payment → issue on explicitly marked test records.
- Receive one test item, print a 58×30 mm Code 128 label at 100% scale, scan the
  physical print using the real phone, sell it and verify the stock balance.
- Verify the Apps Script installation output, trigger list and first scheduled
  execution after 03:00 local time. Read `backup_status` in the owner UI.
- Confirm 20/20 migration entries with hashes and private Drive readback.

## Technical references

- [Atomic Sheets batch updates](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate)
- [Sheets processing limits](https://developers.google.com/workspace/sheets/api/limits)
- [Daily triggers and timezone](https://developers.google.com/apps-script/reference/script/clock-trigger-builder)

## Tests

`node --test tests/google-reliability.test.mjs tests/google-cutover.test.mjs tests/workshop-core.test.mjs tests/pending.test.mjs tests/barcode.test.mjs`

Tests execute the actual Apps Script functions with Sheets/Drive emulators and
inject failures before and after the atomic commit. They do not impersonate a
real employee, prove an actual phone camera works, or prove a scheduled job ran.
