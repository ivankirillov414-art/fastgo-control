# FastGo ТСД 2.0

Native Android application, package `ru.fastgo.tsd`, Android 6+. It installs alongside the legacy WebView terminal because the legacy signing key is unavailable. Do not delete the old application until its pending documents are completed.

Receipt and sale start with an empty native scan screen. A writable Android EditText retains scanner IME input while `setShowSoftInputOnFocus(false)` suppresses the soft keyboard. Foreground iData broadcast input is also supported; physical device verification is required. No WebView, browser search or DOM input is used. Repair QR payment is a separate mode.

SQLite persists catalog, documents and individual scan IDs before network delivery. A deliberate rescan adds quantity; request retries reuse the document ID and revision. Unknown codes are resolved on the laptop. Stock and financial operations are committed only by the laptop. Local catalog synchronization runs every five minutes; scan synchronization runs while the application is active and retries after reconnection.

Sign in once with the same FastGo employee account. If there is only one active warehouse station, routing is selected automatically. With multiple stations, choose the destination once. Unsynced legacy documents are not imported.

Updates: check daily after 18:00 Orenburg time while the app is active (catch up on opening), or tap «Обновить сейчас». APK updates require matching package, version, SHA-256 and signing certificate. Android asks for installation confirmation. The private signing backup is stored separately and must never be committed.

Validation: JVM document tests, native Android emulator IME/focus/persistence test, server unknown-code tests and laptop browser resolution test. Real iData scanning and laptop handoff must also be checked on the actual equipment.
