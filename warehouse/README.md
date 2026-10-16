# Warehouse web releases

After editing warehouse JavaScript, CSS, or either HTML entry point, run:

```sh
node scripts/build-warehouse-web.cjs
node scripts/build-warehouse-web.cjs --check
```

Commit the generated bundle, HTML version markers, and web-version.json together. CI rejects stale releases. Both entry points use the bundled JavaScript so cache-busting covers imports too.

The laptop checks the deployed version once a minute. A reload waits for the home screen, no local document or visible unpaid mirrored basket, no modal, no pending USB scan/target, no installer ready, and at least 15 seconds without input. It verifies that the new HTML and manifest belong to the same release. Network errors retain the current screen. Native installer updates remain on their separate safe-idle schedule.
