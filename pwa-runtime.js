// Compatibility entrypoint. Subscription is now explicitly enabled in ARISE settings.
// Never reuse a public hard-coded device identifier for push subscriptions.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
