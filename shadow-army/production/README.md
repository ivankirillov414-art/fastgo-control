# Production synchronization

The live service bot remains a Supabase Edge Function and keeps its webhook secret authentication. GitHub is the source contract for Shadow Army behavior; provider secrets are never committed.

## State rules

- Project continuity is per Telegram user.
- `Что дальше?` continues the user's most recent active project.
- A selected task is persisted as `in_progress` before delivery.
- A normal reply while waiting closes the exact current task and is stored as a Keeper result.
- `/commands`, project creation, and project listing override result capture.
- Internal planning/analysis belongs to agents; only executable user actions are presented as user tasks.

## Multi-user hardening target

The old v25 production gateway can find a global `in_progress` task. This is acceptable only for the current owner-only beta. Before broader access, current task resolution must be scoped through Telegram-user events/session state rather than global task status.
