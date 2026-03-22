---
name: todo
description: Manage a local TODO.md file. Use when the user says "/todo", "add a todo", "mark todo as done", "list todos", "work on todo", "show todos", "add a note to todo", or asks to track, capture, or manage tasks in a TODO list.
argument-hint: <add|list|done|work|note|remove> [todo title or number]
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# TODO Manager

Manage a `TODO.md` file in the current working directory. The file has two sections:
1. **A bullet list** at the top — one line per todo with summary, priority badge, and anchor link
2. **Detail sections** below — one `##` heading per todo with full context, metadata, and guidance

---

## Operations

Determine the operation from the user's arguments or phrasing:

| User says | Operation |
|-----------|-----------|
| `/todo add ...` or "add a todo for ..." | **add** |
| `/todo list` or `/todo` (no args) or "list todos" or "show todos" | **list** |
| `/todo done <title or number>` or "mark X as done" | **done** |
| `/todo work <title or number>` or "work on X" | **work** |
| `/todo note <title or number> <text>` or "add a note to todo X" | **note** |
| `/todo remove <title or number>` or "delete todo X" | **remove** |

---

## ADD — Adding a new todo

### Step 1: Read TODO.md (or create it if missing)

If `TODO.md` does not exist, create it with this skeleton:

```markdown
# TODO

## Tasks

---
```

If it exists, read it first.

**Note:** When adding the first todo to a freshly created file, insert the bullet item on a blank line directly above the `---` separator. Never leave placeholder comments in the file.

### Step 2: Build the anchor slug

Create a URL-safe anchor slug from the title:
- Lowercase, replace spaces with `-`, strip special characters
- Example: "Fix login bug" → `fix-login-bug`
- If a slug already exists in the file, append `-2`, `-3`, etc.

### Step 3: Determine priority/relevancy

If the user provided a priority or relevancy level (e.g. "high priority", "P1", "low", "critical", "nice-to-have"), normalize it to one of:
- `🔴 High` / `🟡 Medium` / `🟢 Low`

Map common variants: P1/critical/urgent → High, P2/normal → Medium, P3/nice-to-have/low → Low.

If no priority given, omit the badge entirely (do not default to Medium).

### Step 4: Collect metadata

Gather from the current context:
- **Created**: current date and time (ISO 8601, e.g. `2026-03-22 14:30`). To get the current time, run `date '+%Y-%m-%d %H:%M'` via Bash.
- **Folder**: the current working directory (use `$PWD` or the active project path)
- **Project**: the repository or project name (basename of the folder, or from `package.json`/`pyproject.toml` if present)
- **File / Location**: if the todo is about a specific file, function, or line range, record it
- Any other relevant context from the conversation (related issue numbers, PR links, error messages, commands that triggered this, etc.)

### Step 5: Write the bullet list entry

Append to the `## Tasks` bullet list (before the `---` separator):

```
- [<summary>](#<slug>) <priority-badge-if-any>
```

Examples:
```
- [Fix login bug on OAuth flow](#fix-login-bug-on-oauth-flow) 🔴 High
- [Refactor database connection pool](#refactor-database-connection-pool)
- [Add unit tests for parser module](#add-unit-tests-for-parser-module) 🟢 Low
```

Keep the summary short (one line, ~80 chars max). It must be self-explanatory at a glance.

### Step 6: Write the detail section

Append after the `---` separator:

```markdown
## <Title>

> <One-sentence description of what needs to be done and why.>

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

**Important:** Make the detail section comprehensive enough that a future Claude session with no prior context can pick it up and immediately know what to do.

---

## LIST — Showing todos

Read `TODO.md` and display a formatted summary:

```
Open todos in TODO.md:

  #  Title                                   Priority   Status
  1  Fix login bug on OAuth flow             🔴 High    Open
  2  Refactor database connection pool                  Open
  3  Add unit tests for parser module        🟢 Low     Open
  4  Update API documentation                           Done ✓
```

Group by status (Open first, then Done). If the file doesn't exist, say so.

---

## DONE — Marking a todo complete

1. Read `TODO.md`
2. Find the matching todo (by number from LIST, or by fuzzy title match)
3. In the bullet list: add ~~strikethrough~~ around the link text and append ` ✓`
4. In the detail section:
   - Change `Status` from `Open` to `Done`
   - Add `Completed: <current datetime>` row to the Metadata table
5. Append a `### Resolution` subsection to the todo's detail section (see format below)
6. Write the changes back

Example bullet after done:
```
- [~~Fix login bug on OAuth flow~~](#fix-login-bug-on-oauth-flow) 🔴 High ✓
```

### Resolution subsection format

Append this after the last existing subsection of the todo's detail block, before the next `##` heading (or end of file):

```markdown
### Resolution

**Completed:** <current datetime, e.g. 2026-03-22 16:45>

<Generated summary of how the todo was resolved. Include:
- What was actually done (files changed, approach taken, commands run)
- What the root cause turned out to be (if investigative)
- Any decisions made and why
- Anything that deviated from the original "How to work on this" plan
- Relevant output, test results, or confirmation that the work is done
Draw this from the current conversation context — what was discussed, what tools were run, what changes were made.>

<If the user provided text when calling /todo done, include it in a clearly labelled block:>

> **Note from user:** <verbatim user-provided text>
```

**Rules for the Resolution subsection:**
- Always generate a summary from conversation context, even if brief ("No context available — marked done manually.")
- If the user supplied text alongside the done command (e.g. `/todo done 1 — turned out to be a race condition in the session store`), include it verbatim in the `> **Note from user:**` blockquote. Never paraphrase or edit user-provided text.
- If no user text was given, omit the `> **Note from user:**` blockquote entirely.
- Keep generated content and user-provided content visually distinct — the blockquote makes it clear what came from the user vs. what was synthesized.

---

## WORK — Starting work on a todo

1. Read `TODO.md`
2. Find the matching todo (by number or fuzzy title match)
3. Read and display the full detail section to the user
4. Then say: "I'm ready to work on **<title>**. Based on the context above, here's my plan:" and outline the next steps from the "How to work on this" section.
5. Proceed to implement or investigate as guided by the section.

---

## NOTE — Adding a note to a todo

1. Read `TODO.md`
2. Find the matching todo (by number or fuzzy title match)
3. Locate or create the `### Notes` subsection within that todo's detail block
4. Append the new note entry (see format below)
5. Write the changes back
6. Confirm to the user: "Added note to **<title>**."

### Notes subsection format

The `### Notes` subsection is placed after `### Context` and before `### How to work on this`. If it doesn't exist yet, create it in that position.

Each note is a `####` subheading under `### Notes`, with a short summary as the title and the datetime in parentheses:

```markdown
### Notes

#### Session store might be related (2026-03-22 14:30)

(@alice) Talked to Alice — she says the session store was migrated to Redis last sprint, might be related.

#### Blocked on PR #401 (2026-03-23 09:15)

(@alice) This is now blocked on PR #401 landing first. — Confirmed: `handleOAuthCallback()` calls `sessionStore.get()` which was changed in PR #401 to use the new Redis client.
```

### What goes into a note

- **Title:** Write a short summary (3–8 words) capturing the essence of the note, followed by the datetime in parentheses: `#### <summary> (<datetime>)`
- **Body:** The user's text is included verbatim, prefixed with `(@username)` where `username` is the actual system username (run `whoami` via Bash to get it). This distinguishes user-provided content from generated content.
- If there is also relevant context from the conversation (e.g. error output, findings from recent tool calls, code snippets), append a generated paragraph after the user's text, without the `(@username)` prefix.

Example:

```markdown
#### Semicolon delimiter needed for EU (2026-03-22 10:15)

(@alice) The CSV parser also needs to handle semicolon-delimited files for EU customers.

Confirmed: `src/parser/csv.ts` currently hardcodes `,` as delimiter on line 14.

#### Nice to have before Q2 (2026-03-23 14:30)

(@alice) Low priority but would be nice to have before the Q2 release.
```

**Rules:**
- Always use the current datetime (e.g. `2026-03-22 14:30`) as the timestamp. Run `date '+%Y-%m-%d %H:%M'` to get it.
- Always mark user-provided text with `(@username)` at the start, where `username` comes from `whoami`
- If the user provides no text but asks to "add a note", prompt them for what to write — don't generate a note from thin air
- If the user provides text AND there's useful conversation context to add, put the user text (with `(@username)`) first, then add generated context as a separate paragraph below (without a prefix)
- Notes are append-only — never edit or remove existing notes (use `remove` to delete the whole todo if needed)

---

## REMOVE — Deleting a todo

1. Read `TODO.md`
2. Find the matching todo
3. Remove both the bullet list entry and the full detail section
4. Confirm deletion to the user

---

## File format rules

- The `## Tasks` section contains only bullet list items (and the `---` separator at the end)
- All detail sections are `##` headings placed after the `---`
- Never renumber or reorder existing entries; always append new ones
- Preserve all existing content when editing

---

## Example TODO.md

```markdown
# TODO

## Tasks

- [~~Fix login bug on OAuth flow~~](#fix-login-bug-on-oauth-flow) 🔴 High ✓
- [Add unit tests for parser module](#add-unit-tests-for-parser-module) 🟢 Low

---

## Fix login bug on OAuth flow

> OAuth login silently fails when the provider returns a `state` mismatch; users see a blank screen.

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

### Resolution

**Completed:** 2026-03-22 17:30

The root cause was a 30-second TTL on the session state key in Redis, which expired before the OAuth provider redirected back under slow network conditions. Increased the TTL to 10 minutes in `src/session/store.ts:58` and added a fallback to re-generate the state if the key is missing. All OAuth tests pass (`npm test -- --grep oauth`: 12/12). Deployed to staging and verified login works end-to-end.

> **Note from user:** turned out to be a race condition in the session store, not the OAuth library itself

---

## Add unit tests for parser module

> The parser has zero test coverage; any refactor risks silent regressions.

### Metadata

| Field    | Value |
|----------|-------|
| Created  | 2026-03-22 11:00 |
| Folder   | `/Users/alice/projects/myapp` |
| Project  | myapp |
| Priority | 🟢 Low |
| Status   | Open |
| Location | `src/parser/` |

### Context

The `src/parser/` module was written quickly and has no tests. It handles CSV and JSON input parsing for the data import feature. There are known edge cases around empty rows and malformed UTF-8 that have caused support tickets (#301, #318).

### Notes

#### Semicolon delimiter needed for EU (2026-03-22 11:20)

(@alice) The CSV parser also needs to handle semicolon-delimited files for EU customers.

Confirmed: `src/parser/csv.ts` currently hardcodes `,` as delimiter on line 14.

#### Nice to have before Q2 (2026-03-23 15:45)

(@alice) Low priority but would be nice to have before the Q2 release.

### How to work on this

1. Read all files in `src/parser/`
2. Write tests in `tests/parser/` mirroring the source structure
3. Cover: happy path, empty input, malformed input, encoding edge cases
4. Run `npm test` to confirm passing
```
