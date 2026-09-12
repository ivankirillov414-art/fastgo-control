# FastGo reliability work — 2026-09-12

## Applied to production during this task

The workshop interface is published through GitHub Pages, and
`fastgo-workshop-api` version 6 is active with release
`workshop-reliability-2026-09-12`. The storage and service proxies return this
release too. Unauthenticated catalogue requests remain rejected with HTTP 401.
The published employee sign-in screen renders successfully; no application
console errors were observed. This does not verify an authenticated employee
session.

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

## Implementation awaiting Google activation

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
readback. The current regression suite passed 66 tests.
A separate wildcard test run also included the old `workshop-api.test.mjs`
fixture, which still mocks the former direct-Supabase backend and lacks the
gateway's text-decoder globals. That legacy fixture fails and is not part of
the current Google regression workflow; it still needs migration or retirement.
`installReliability` now reports HTTP 403 because Google Sheets API is disabled
in the associated Cloud project. Installation has not completed, and the live
web app deployment has not been changed. Enabling Sheets API, completing
installation and updating the existing deployment remain
required for atomic writes, product photographs and photo migration. The app
gates these features by server capabilities. The 20 originals have not yet been
copied by this task; 4 are unlinked to orders. Real employee login, real camera,
thermal printer and daily execution remain unverified.

Supabase continues to provide authentication, roles, connection configuration
and the retained old objects. It has not been removed.
