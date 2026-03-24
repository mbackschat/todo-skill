# TODO Skill — Format Templates and Examples

## Detail file template (`TODO/<NNN>-<slug>.md`)

```markdown
## #<NNN> <Title>

<One-sentence description of what needs to be done and why.>

### Metadata

| Field    | Value |
|----------|-------|
| Created  | <datetime> |
| Folder   | `<absolute path>` |
| Project  | <project name> |
| Priority | <badge> |
| Status   | Open |
| Location | `<file:line>` or `<file>` *(if applicable)* |

### Context

<Explain the background. Why does this need to be done? What is the current state? Include:
- Relevant error messages, stack traces, or log output
- Related files, functions, classes, or modules
- Any constraints or requirements mentioned by the user
- Links to issues, PRs, docs, or external resources if mentioned
- The exact user request or quote that prompted this todo>

### How to work on this

<Step-by-step guidance for Claude (or the user) to pick this up later:
1. What to read first (files, functions, docs)
2. What the change or investigation should involve
3. Any gotchas, known constraints, or things to watch out for
4. How to verify the work is done>
```

## Example: Full split-file layout

### `TODO.md` — the index file (entire file)

```markdown
# TODO

## Tasks

| No | Title | Priority | Status | Created | Changed |
|----|-------|----------|--------|---------|---------|
| 001 | [~~Fix login bug on OAuth flow~~](TODO/DONE/001-fix-login-bug-on-oauth-flow.md) | 🔴 High | Done ✓ | 2026-03-22 09:45 | 2026-03-22 17:30 |
| 002 | [Add unit tests for parser module](TODO/002-add-unit-tests-for-parser-module.md) | 🟢 Low | Active | 2026-03-22 11:00 | 2026-03-23 16:00 |

---
<!-- next: 3 -->
```

### `TODO/002-add-unit-tests-for-parser-module.md` — active todo (work started)

```markdown
## #002 Add unit tests for parser module

The parser has zero test coverage; any refactor risks silent regressions.

### Metadata

| Field    | Value |
|----------|-------|
| Created  | 2026-03-22 11:00 |
| Folder   | `/Users/alice/projects/myapp` |
| Project  | myapp |
| Priority | 🟢 Low |
| Status   | Active |
| Location | `src/parser/` |

### Context

The `src/parser/` module was written quickly and has no tests. It handles CSV and JSON input parsing for the data import feature. There are known edge cases around empty rows and malformed UTF-8 that have caused support tickets (#301, #318).

### How to work on this

1. Read all files in `src/parser/`
2. Write tests in `tests/parser/` mirroring the source structure
3. Cover: happy path, empty input, malformed input, encoding edge cases
4. Run `npm test` to confirm passing

### Notes

#### Semicolon delimiter needed for EU (2026-03-22 11:20)

(@alice) The CSV parser also needs to handle semicolon-delimited files for EU customers.

Confirmed: `src/parser/csv.ts` currently hardcodes `,` as delimiter on line 14.

#### Nice to have before Q2 (2026-03-23 15:45)

(@alice) Low priority but would be nice to have before the Q2 release.

### Work Log

#### Context and Plan

**Active since:** 2026-03-23 16:00

Plan: read all files in `src/parser/`, create `tests/parser/` directory mirroring the source structure, write unit tests covering happy path CSV/JSON parsing, empty input, malformed input, and UTF-8 encoding edge cases. Will also add semicolon delimiter tests per the note above. Verify with `npm test`.
```

### `TODO/DONE/001-fix-login-bug-on-oauth-flow.md` — completed todo

```markdown
## #001 Fix login bug on OAuth flow

OAuth login silently fails when the provider returns a `state` mismatch; users see a blank screen.

### Metadata

| Field     | Value |
|-----------|-------|
| Created   | 2026-03-22 09:45 |
| Completed | 2026-03-22 17:30 |
| Folder    | `/Users/alice/projects/myapp` |
| Project   | myapp |
| Priority  | 🔴 High |
| Status    | Done |
| Location  | `src/auth/oauth.ts:142` |

### Context

User reported that clicking "Login with GitHub" redirects back to the app but shows a blank page. The browser console shows:

```
Error: state mismatch — expected abc123, got xyz789
```

The `state` parameter is generated in `generateOAuthState()` (src/auth/oauth.ts:89) and validated in `handleOAuthCallback()` (line 142). The issue may be related to the session store expiring the state before the callback arrives, especially under load.

Related: GitHub issue #412, PR #389 (previous attempt that was reverted).

### How to work on this

1. Read `src/auth/oauth.ts`, focusing on `generateOAuthState()` and `handleOAuthCallback()`
2. Check how the state is stored — look at `src/session/store.ts`
3. Reproduce by setting a very short session TTL and triggering OAuth
4. Fix: likely increase state TTL or use a separate short-lived state store
5. Verify: run `npm test -- --grep oauth` and do a manual login test

### Notes

#### Session store might be the culprit (2026-03-22 11:00)

(@alice) Talked to Bob — he says the session store was migrated to Redis last sprint, might be related.

### Work Log

#### Context and Plan

**Active since:** 2026-03-22 14:00

Plan: investigate the Redis session store TTL settings in `src/session/store.ts`, reproduce the issue by setting a short session TTL, then fix the state expiration. Focus on `generateOAuthState()` and `handleOAuthCallback()` in `src/auth/oauth.ts`.

#### Conclusion

**Completed:** 2026-03-22 17:30

The root cause was a 30-second TTL on the session state key in Redis, which expired before the OAuth provider redirected back under slow network conditions. Increased the TTL to 10 minutes in `src/session/store.ts:58` and added a fallback to re-generate the state if the key is missing. All OAuth tests pass (`npm test -- --grep oauth`: 12/12). Deployed to staging and verified login works end-to-end.

***User note:*** turned out to be a race condition in the session store, not the OAuth library itself
```

## Table row format

```
| <NNN> | [<summary>](TODO/<NNN>-<slug>.md) | <priority-badge-or-empty> | <status> | <created-datetime> | <changed-datetime> |
```

Examples:
```
| 001 | [Fix login bug on OAuth flow](TODO/001-fix-login-bug-on-oauth-flow.md) | 🔴 High | Open | 2026-03-22 09:45 | 2026-03-22 09:45 |
| 002 | [Refactor database connection pool](TODO/002-refactor-database-connection-pool.md) | | Active | 2026-03-22 10:15 | 2026-03-22 14:00 |
| 003 | [Add unit tests for parser module](TODO/003-add-unit-tests-for-parser-module.md) | 🟢 Low | Open | 2026-03-22 11:00 | 2026-03-22 11:00 |
```

After marking done (link updated to `TODO/DONE/`, file moved there):
```
| 001 | [~~Fix login bug on OAuth flow~~](TODO/DONE/001-fix-login-bug-on-oauth-flow.md) | 🔴 High | Done ✓ | 2026-03-22 09:45 | 2026-03-22 17:30 |
```

## Notes subsection format

Each note is a `####` subheading under `### Notes`:

```markdown
### Notes

#### <Short summary, 3-8 words> (<datetime>)

(@<username>) <user's text verbatim>

<Optional: generated context paragraph without (@username) prefix>
```

## Counter format

The counter is an HTML comment at the end of `TODO.md`, after the `---` separator:

```markdown
---
<!-- next: 3 -->
```

The counter tracks the next number to assign. It is incremented each time a todo is added and never decremented (even when todos are removed).
