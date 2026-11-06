# Shadow Army batch QA

The branch is tested as a conversation system, not as isolated Telegram phrases.

## Release gate

A package is ready for manual Telegram verification only after CI passes:

- migrations + seed;
- PROJECT-001 bootstrap;
- API imports;
- deterministic conversation routing;
- 40+ dialogue variants;
- result -> next -> result continuity;
- commands/new-project/list-projects are never swallowed as task results;
- isolated Shadow Army web surface exists and does not replace root pages.

## Production smoke after deploy

1. `/status`
2. `Что дальше?`
3. send plain result without project title
4. `Что дальше?`
5. `Проекты`

Only this short smoke needs a human Telegram check; the rest belongs to automated CI.
