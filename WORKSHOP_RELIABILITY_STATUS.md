# FastGo reliability work — 2026-09-12

## Applied to production during this task

The workshop interface is published through GitHub Pages, and
`fastgo-workshop-api` version 13 is active with release
`workshop-autonomous-2026-09-13`. The storage and service proxies return this
release too. Unauthenticated catalogue requests remain rejected with HTTP 401.
The published employee sign-in screen renders successfully; no application
console errors were observed. A real owner sign-in with the FastGo account succeeded on 2026-09-13.
The home view and inventory loaded real Google data. Some subsequent reads
intermittently return a non-JSON Google response; version 13 adds bounded, credential-free ContentService redirects and retries
for reads only, with fixed response
classifications without exposing bodies, tokens, secrets or redirect URLs.
Business mutations and the full employee lifecycle remain unverified.

Legacy inventory writes are blocked by statement triggers on `parts`,
`stock_movements`, legacy receipt/sales headers and lines, and workshop sales
headers and lines. Service-role write attempts were tested inside rollback-only
transactions and rejected with `LEGACY_INVENTORY_READ_ONLY`. Existing rows remain
readable. Verified snapshot: 80 products, total quantity 167.

A private Google spreadsheet backup and a separate restored copy were created in the existing backup folder.

Compared A1:AD200 in 16 operational sheets using FORMULA rendering. All compared
values/formulas match. Metadata confirms 18 tabs and both copies are unshared.
This is a bounded restore check, not an authenticated application test or a
claim that a daily trigger has executed.

## Google activation completed on 2026-09-13

Atomic Google mutations and recovery fence; private product/model/category
photos; verified migration handler for 20 old objects; daily backup trigger and
restore verification; persisted browser request IDs and sale cart; scanner and
label scripts bundled locally; synchronous print-window opening.

40 automated checks passed, including actual label-generation/decoder pairing,
fault injection, retry after page reload, last-item sales, full repair lifecycle,
role restrictions, photo access and migration checksums.

The prepared source is now saved in the existing FastGo API Apps Script project:
the existing `Код.gs`, new `Reliability.gs`, and the manifest. Editor readback
matched the prepared source. The original code differed from the reference only
by blank lines. The manifest preserves the existing web app execution identity
and audience. The additional outbound-request scope has now been granted.
The current repository Google source (including barcode/model validation and
formula-stable backup verification) is saved and was verified by full editor
readback. The current regression suite passed 72 tests, including response redirects,
read retries, write non-replay and diagnostic redaction.
A separate wildcard test run also included the old `workshop-api.test.mjs`
fixture, which still mocks the former direct-Supabase backend and lacks the
gateway's text-decoder globals. That legacy fixture fails and is not part of
the current Google regression workflow; it still needs migration or retirement.
Google Sheets API v4 was enabled in the existing project after the owner's
explicit approval of the API terms. `installReliability` completed successfully
on 2026-09-13 (05:38 UTC). The trigger list shows exactly one time-based
`dailyBackup` trigger. The code configures it daily at hour 03 in
Asia/Yekaterinburg; no scheduled execution has occurred yet.

The installation verified a complete workbook digest for backup
`1a5TxaydZxhzdRlKdowwAXRS-TPCFvq5xjnvC8ibPXZc` and restored it to the isolated copy
`1fAelWKaS6e5tX-sYKRzUIaInOOqcBjgNrzH6v_dLSkQ`. Both have only the existing
owner's permission and are not shared. Photos remain referenced, not duplicated
as binaries, in these workbook copies.

The existing web app deployment was updated from version 1 to version 2 at
05:42 UTC, preserving its URL, owner execution identity and audience. The
deployment URL matches `workshop_backend_config.sheets_api_url`. This publishes
the prepared atomic-write and private-photo implementation. Versions 3 and 4
subsequently preserve retry IDs on busy locks/unclassified Google failures
(HTTP 503), and attach a fresh response ID to ContentService responses. Version
4 is the current deployment; its source was verified by full editor readback.
The app still
gates these features by server capabilities; authenticated live verification
remains necessary. A real owner session confirmed backup status and started migration. At least
3 of 20 objects have confirmed migrated manifest entries (migration is still
in progress); 4 are unlinked to orders. A test intake with serial
`FASTGO-QA-20260913` was created once as repair
`a918df5b-3c16-40d9-8349-fc074d05d85f`, intake `FGI-0007`, request
`d24c478b-5398-495a-9903-c52c1d74071c`. The UI disabled repeat submission while
the request was pending. The full repair/payment/issue and stock/sale cycles
remain in progress. Real camera, thermal printer and daily execution remain
unverified.

Supabase continues to provide authentication, roles, connection configuration
and the retained old objects. It has not been removed.
