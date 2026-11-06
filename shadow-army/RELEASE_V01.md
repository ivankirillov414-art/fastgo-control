# Shadow Army v0.1 release contract

## Automated before production
- CI green
- migrations and seed green
- PROJECT-001 bootstrap green
- API import green
- conversation matrix green
- result/next continuity green

## Telegram production
Current gateway uses explicit current task + recent project continuity. A human should only smoke-test `/status`, `Что дальше?`, one plain result, then `Что дальше?`.

## Web
`/shadow-army-web/` is isolated from the existing FastGo and personal dashboard pages. It is a status surface for the Shadow Army package and must not replace root pages.

## Safety
No tokens or provider secrets are committed. Website modifications outside the isolated Shadow Army path require a separate explicit change.
