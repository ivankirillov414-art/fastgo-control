# Warehouse 1.0.21 / common app 1.0.24

- Cancel an individual unknown scan from the list or its dialog. The server retains a completed cancellation so terminal retries cannot restore it. No stock, payment or other scan changes.
- Preserve list buttons across unchanged background polling; wrap long QR URLs so they cannot expand the page.
- Keep the dark native header fixed, reserve Windows caption space at 850–1250 px and scroll content below it.
- Persisted USB inbox entries survive installation and no longer block it when no document is open. Pause new USB documents while an update is ready; back off transient failures for five seconds.
- Release the interface lock with an explicit error if installer shutdown does not occur within 30 seconds.

Old installed warehouse 1.0.17 cannot receive native fixes before an installer runs. Publishing a new release does not prove installation on Home-PC. Check device receipts; do not install warehouse on the development laptop as a substitute.
