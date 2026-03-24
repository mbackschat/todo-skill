# TODO Skill — End-to-End Test Playbook

This playbook exercises all 8 operations through realistic scenarios with 2 todos. Follow each step in order. After each step, verify the result before proceeding.

---

## Pre-flight

1. If `TODO.md` or a `TODO/` directory exists, archive them before proceeding:
   ```bash
   zip -r "TODO-$(date '+%Y%m%d-%H%M%S').zip" TODO.md TODO/ 2>/dev/null; rm -rf TODO.md TODO/
   ```
   Tell the user: "Archived existing TODO.md and TODO/ to `TODO-<datetime>.zip`."
   If neither exists, skip this step.
2. Tell the user: "Running end-to-end test of the /todo skill. This will create 2 test todos and exercise all operations. Test files will be kept for inspection."

---

## Step 1: ADD — Create todo #1

Execute the **add** operation with these specifics:

- **Title:** Fix flaky timeout in CI integration tests
- **Priority:** High
- **Context to write in the detail file:**
  > The `test:integration` CI job on GitHub Actions has been failing intermittently for the past week. Approximately 3 out of 10 runs time out after 120 seconds in the `api/orders.test.ts` suite. The `POST /orders` endpoint test creates a test database, seeds it, runs 14 assertions, then tears down. Local runs pass consistently. The timeout started after commit `a1b2c3d` which upgraded the Postgres Docker image from 15.4 to 16.1. The CI logs show the connection pool exhausting at 10 connections during parallel test execution. Related: GitHub issue #247.
- **How to work on this:**
  > 1. Read `api/orders.test.ts` and `config/database.ts` for pool settings
  > 2. Check if Postgres 16.1 changed default connection limits
  > 3. Compare CI Docker config (`docker-compose.ci.yml`) with local (`docker-compose.yml`)
  > 4. Likely fix: increase `max_connections` in CI Postgres config or reduce test parallelism
  > 5. Verify: run `npm run test:integration` 10 times in CI to confirm stability
- **Location:** `api/orders.test.ts`

After adding, verify: `TODO.md` has 1 row, `TODO/001-fix-flaky-timeout-in-ci-integration-tests.md` exists.

---

## Step 2: ADD — Create todo #2

Execute the **add** operation with these specifics:

- **Title:** Add retry logic to webhook delivery
- **Priority:** Medium
- **Context to write in the detail file:**
  > Customer support reported that 15% of webhook deliveries to `https://partner-api.example.com/events` are failing silently. The webhook handler in `src/webhooks/deliver.ts` fires a single `fetch()` call and logs the result but does not retry on failure. The partner API occasionally returns 503 during deployments (their maintenance window is Tuesdays 2-3am UTC). Currently, failed webhooks are lost — there is no dead letter queue or retry mechanism. The `WebhookEvent` table in the database has a `delivered_at` column that stays null on failure, making it possible to query undelivered events.
- **How to work on this:**
  > 1. Read `src/webhooks/deliver.ts` for the current delivery logic
  > 2. Add exponential backoff retry (3 attempts: 1s, 5s, 25s)
  > 3. Add a `retry_count` and `last_error` column to the `WebhookEvent` table
  > 4. Create a background job (`src/jobs/retry-webhooks.ts`) that picks up failed deliveries
  > 5. Verify: write a test that mocks a 503 response and confirms 3 retries
- **Location:** `src/webhooks/deliver.ts`

After adding, verify: `TODO.md` has 2 rows, `TODO/002-add-retry-logic-to-webhook-delivery.md` exists.

---

## Step 3: LIST — Show both todos

Execute the **list** operation.

Verify: Output shows 2 todos, both in `Open` status, with correct priorities (High and Medium).

---

## Step 4: NOTE — Add a note to todo #1

Execute the **note** operation on todo #1 with this text:

> Bob from DevOps confirmed the CI runner was also upgraded from `ubuntu-22.04` to `ubuntu-24.04` in the same PR. The new runner has a lower default `shmmax` kernel parameter which could affect Postgres shared memory allocation.

Use the summary: "DevOps confirmed runner OS upgrade too"

After adding, verify: The note appears in `TODO/001-fix-flaky-timeout-in-ci-integration-tests.md` under `### Notes` with a `(@username)` prefix and timestamp.

---

## Step 5: WORK — Start working on todo #1

Execute the **work** operation on todo #1.

Use this plan narrative in the Context and Plan:
> Investigating the CI timeout by comparing the Docker and runner configurations between the working and broken states. Will check Postgres 16.1 release notes for connection handling changes, then inspect the `shmmax` kernel parameter difference between Ubuntu 22.04 and 24.04. If the kernel parameter is the issue, will add an explicit `shmmax` setting to `docker-compose.ci.yml`. If it's the Postgres version, will pin back to 15.4 or adjust `max_connections`.

After executing, verify:
- `TODO.md` shows todo #1 as `Active`
- The detail file has `Status: Active` and a `### Work Log` section with `#### Context and Plan`

---

## Step 6: LOG — Log a finding on todo #1

Execute the **log** operation on todo #1 with this text:

> Found it — `shmmax` on the new runner is 32MB vs 128MB on the old one. Postgres 16.1 tries to allocate 64MB of shared memory by default, which silently falls back to a smaller allocation and causes connection pool starvation under parallel load.

Use the summary: "Root cause is shmmax kernel parameter"

After executing, verify: The log entry appears under `### Work Log` (not `### Notes`, because the todo is Active) with timestamp and attribution.

---

## Step 7: DONE — Mark todo #1 complete

Execute the **done** operation on todo #1.

Use this conclusion narrative:
> Root cause was the `shmmax` kernel parameter on the new Ubuntu 24.04 CI runner (32MB vs 128MB on 22.04). Postgres 16.1 defaults to 64MB shared memory allocation, which silently fell back to a smaller pool, causing connection exhaustion under parallel test load. Fixed by adding `shm_size: 256mb` to the Postgres service in `docker-compose.ci.yml`. Also pinned the runner back to `ubuntu-22.04` as a safety measure until the team reviews all kernel parameter changes. Ran the integration suite 20 times in CI — 0 failures.

After executing, verify:
- `TODO.md` shows todo #1 as `Done ✓` with strikethrough title
- The file moved to `TODO/DONE/001-fix-flaky-timeout-in-ci-integration-tests.md`
- The detail file has `Status: Done`, a `| Completed | ... |` metadata row, and a `#### Conclusion` section

---

## Step 8: LIST — Show mixed states

Execute the **list** operation.

Verify: Output shows todo #1 as `Done ✓` and todo #2 as `Open`, grouped correctly (Open before Done).

---

## Step 9: REOPEN — Reopen todo #1

Execute the **reopen** operation on todo #1.

After executing, verify:
- `TODO.md` shows todo #1 as `Open` (no strikethrough)
- The file moved back to `TODO/001-fix-flaky-timeout-in-ci-integration-tests.md`
- The detail file has `Status: Open`, the `| Completed |` row is removed
- All Work Log and Conclusion content is preserved

---

## Step 10: WORK — Start working on todo #2

Execute the **work** operation on todo #2.

Use this plan narrative:
> Implementing exponential backoff retry for webhook delivery. Will modify `src/webhooks/deliver.ts` to wrap the fetch call in a retry loop with delays of 1s, 5s, and 25s. Adding `retry_count` and `last_error` columns to the `WebhookEvent` table via a migration. Then creating a background job to sweep for undelivered events older than 1 hour.

After executing, verify: `TODO.md` shows todo #2 as `Active`.

---

## Step 11: DONE — Mark todo #1 complete (second time)

Execute the **done** operation on todo #1 (it was reopened in step 9).

Use this conclusion narrative:
> After reopening, confirmed the fix holds under sustained load. The `shm_size: 256mb` setting in `docker-compose.ci.yml` resolves the connection pool exhaustion. Kept the runner pinned to `ubuntu-22.04` per team decision in standup. CI has been green for 3 days straight. Closing for real this time.

After executing, verify: Todo #1 is back in `Done ✓` with a second Conclusion entry in the Work Log.

---

## Step 12: DONE — Mark todo #2 complete

Execute the **done** operation on todo #2.

Use this conclusion narrative:
> Added exponential backoff retry (1s, 5s, 25s) to `src/webhooks/deliver.ts`. New columns `retry_count` and `last_error` added to `WebhookEvent` table via migration `20260324_add_webhook_retry.sql`. Background job `src/jobs/retry-webhooks.ts` runs every 5 minutes and picks up events with `delivered_at IS NULL AND retry_count < 3`. Unit test confirms 3 retries on 503 responses. Integration test with a mock server validates the full flow.

After executing, verify: Both todos are now `Done ✓`.

---

## Step 13: LIST — Final state

Execute the **list** operation.

Verify: Both todos show as `Done ✓`.

---

## Step 14: REMOVE — Delete todo #2

Execute the **remove** operation on todo #2.

After executing, verify:
- `TODO.md` has only 1 row (todo #1)
- `TODO/DONE/002-add-retry-logic-to-webhook-delivery.md` is deleted
- The counter is still `<!-- next: 3 -->` (not decremented)

---

## Report

Tell the user: "All 8 operations tested successfully. Test files kept for inspection."

Write a `REPORT.md` file with the test results. Get the current datetime via `node $TODO meta`. Use this template:

```markdown
# /todo test — REPORT

**Date:** <datetime>
**Result:** PASSED

## Operations tested

| Operation | Count | Details |
|-----------|-------|---------|
| add | 2x | Both with full context and metadata |
| list | 3x | Mixed states, all done, after remove |
| note | 1x | Appended to Notes section |
| work | 2x | Both todos activated with plans |
| log | 1x | Routed to Work Log for Active todo |
| done | 3x | First completion, re-completion after reopen, second todo |
| reopen | 1x | Preserved all history |
| remove | 1x | Deleted row and file, kept counter |

## State transitions verified

```
Open → Active → Done → Open → Done  (todo #1)
Open → Active → Done → Removed      (todo #2)
```

## Files left for inspection

- `TODO.md` — Final index state (1 row after remove)
- `TODO/DONE/001-fix-flaky-timeout-in-ci-integration-tests.md` — Full lifecycle detail file
```

Then display the report content to the user.
