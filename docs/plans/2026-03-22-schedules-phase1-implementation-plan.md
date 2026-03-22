# Schedule Phase 1 Implementation Plan

## Goal

Add daily and weekly schedules to the web app, store them as cron-backed records, and execute due schedules serially without concurrent scheduled runs.

## Task 1: Add Schedule Domain Model

Files:

- `src/core/schedules/schedule-types.js`
- `src/core/schedules/schedule-store.js`
- `tests/server/schedule-store.test.js`

Work:

- define schedule record fields
- normalize daily/weekly config
- persist schedules under `schedules/`
- support create/get/list/update

## Task 2: Add Schedule Time Helpers

Files:

- `src/core/schedules/cron.js`
- `tests/server/schedule-cron.test.js`

Work:

- convert UI inputs to cron expressions
- compute `nextRunAt`
- support:
  - daily `HH:mm`
  - weekly `weekday + HH:mm`

## Task 3: Add Schedule Runner

Files:

- `src/core/schedules/run-schedules.js`
- `tests/server/run-schedules.test.js`

Work:

- scan enabled schedules
- detect due schedules
- create queued executions
- enforce serial execution for scheduled runs
- create jobs using the existing job creation flow

## Task 4: Add Schedules API

Files:

- `app/api/schedules/route.ts`
- `app/api/schedules/[id]/route.ts`
- `app/api/schedules/[id]/toggle/route.ts`
- `app/api/schedules/[id]/run-now/route.ts`
- `tests/web/schedules-api.test.js`

Work:

- create/list/detail
- toggle enabled state
- manual run-now action

## Task 5: Add Schedule UI

Files:

- `app/schedules/page.tsx`
- `app/schedules/[id]/page.tsx`
- `components/schedule-form.tsx`
- `components/schedule-list.tsx`
- `components/schedule-detail.tsx`
- `tests/web/schedules-page.test.js`

Work:

- build daily/weekly form
- show cron expression as read-only derived field
- show next run / last run / enabled status
- support toggle and run-now

## Task 6: Integrate Schedule Runner Startup

Files:

- Next.js server startup integration point
- `docs/setup/web-app-deployment.md`

Work:

- start runner in-process for phase 1
- document operational expectations
- add verification step for schedule runtime

## Verification

At the end of implementation, run:

```bash
node --test tests/server/schedule-store.test.js tests/server/schedule-cron.test.js tests/server/run-schedules.test.js tests/web/schedules-api.test.js tests/web/schedules-page.test.js
```

Then run the broader integration set that covers existing jobs plus schedules.
