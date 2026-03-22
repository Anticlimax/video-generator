# Schedule Phase 1 Design

## Goal

Add a first scheduling layer to the web app so an internal user can configure:

- a daily run at a fixed local time
- a weekly run at a fixed local weekday and time

Each schedule should automatically create the same kind of generation job the app already supports:

- generate video
- optionally generate separate cover
- optionally generate motion video
- optionally publish to YouTube

This phase does not introduce authentication, multi-user behavior, or distributed workers.

## Product Shape

The user-facing configuration stays simple:

- `Daily` + `HH:mm`
- `Weekly` + `weekday` + `HH:mm`

The backend stores a normalized cron-style expression for execution and management.

This keeps the UI simple while giving the runtime a single schedule format.

## Schedule Semantics

### Supported Modes

- `daily`
- `weekly`

### Stored Fields

Each schedule record should contain:

- `id`
- `enabled`
- `kind`
- `time`
- `weekday` for weekly schedules
- `cronExpression`
- `timezone`
- `payload`
- `lastRunAt`
- `nextRunAt`
- `lastJobId`
- `createdAt`
- `updatedAt`

### Payload

The schedule payload should mirror the existing job creation payload:

- `theme`
- `style`
- `durationTargetSec`
- `masterDurationSec`
- `provider`
- `publishToYouTube`
- `videoVisualPrompt`
- `generateSeparateCover`
- `generateMotionVideo`
- `coverPrompt`

## Execution Model

Phase 1 should keep execution on the same host as the web app.

The runtime is split into three responsibilities:

1. Web UI and API
2. Schedule runner
3. Existing job runner

The schedule runner should:

- wake up on a fixed interval, once per minute is enough
- read enabled schedules
- find schedules whose `nextRunAt <= now`
- enqueue a pending execution
- hand it off to job creation only when the generator is idle

## Queueing Rule

If the previous scheduled run is still active when the next scheduled time arrives:

- do not run concurrently
- do not drop the run
- queue it

This means schedule firing and job execution are separate concerns:

- schedule becomes due
- a queued execution record is created
- the runner drains queued executions in FIFO order when no other scheduled execution is running

Phase 1 can keep the queue implicit if needed:

- detect due schedules
- create one waiting execution per due schedule
- claim the oldest waiting execution when the runner is free

## Timezone

Phase 1 should use a single server-local timezone and store it on the schedule record for visibility.

This avoids hidden behavior and keeps future timezone-specific scheduling possible without changing the model.

## Data Storage

To minimize disruption, schedules should follow the current filesystem-backed persistence pattern first.

Recommended layout:

- `schedules/<schedule_id>/schedule.json`
- `schedules/<schedule_id>/runs/<run_id>.json`

This keeps phase 1 aligned with the existing `jobs/` model.

SQLite can still be introduced later as a phase-2 migration without changing the product semantics.

## APIs

Phase 1 should add:

- `GET /api/schedules`
- `POST /api/schedules`
- `GET /api/schedules/:id`
- `POST /api/schedules/:id/toggle`
- `POST /api/schedules/:id/run-now`

The backend should convert daily/weekly input into:

- `cronExpression`
- `nextRunAt`

## UI

Phase 1 only needs:

1. Schedule list page
   - status
   - next run
   - last run
   - quick actions

2. New schedule page or inline create form
   - daily/weekly selector
   - time input
   - weekday selector for weekly
   - same content fields as manual job creation

3. Schedule detail page
   - normalized cron expression
   - payload summary
   - next run
   - recent executions

## Error Handling

Schedule errors should be separated from job errors.

Examples:

- invalid schedule input
- next run calculation failed
- schedule runner failed to create a job
- execution skipped because queue record already exists

The schedule should remain enabled unless the error indicates corrupted configuration.

## Testing Strategy

Phase 1 should add tests for:

- schedule record normalization
- daily and weekly cron expression generation
- next-run calculation
- API create/list/detail/toggle/run-now
- runner queue behavior
- no-concurrency rule

## Recommendation

Implement phase 1 with:

- filesystem-backed `schedule-store`
- cron expression stored on the record
- a lightweight in-process schedule runner
- simple web pages and APIs

This is the smallest path to “single deployable app with manual and timed generation” while preserving a clean upgrade path to worker-based execution later.
