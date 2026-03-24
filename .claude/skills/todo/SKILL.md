---
name: todo
description: This skill manages a local TODO.md task list with rich context tracking. Use when the user says "/todo", "add a todo", "mark todo as done", "list todos", "work on todo", "show todos", "add a note to todo", "log on todo", or asks to track, capture, or manage tasks in a TODO list.
argument-hint: <add|list|note|work|log|done|reopen|remove|test> [todo title or number]
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# TODO Manager

Manage a structured, Markdown-based task list using a **split-file architecture**:

- **`TODO.md`** — A lightweight index containing a numbered table of todos and a counter
- **`TODO/<NNN>-<slug>.md`** — One file per todo, in a `TODO/` subdirectory, with full context, metadata, and guidance
- **`TODO/DONE/`** — Completed todo files are moved here

This split keeps todo details out of Claude's context window when they aren't needed. Most mechanical operations (table manipulation, counter, file moves) are handled by the helper script `todo.mjs`.

**Helper script:** `todo.mjs` lives in the same directory as this skill file. Before the first script call in any operation, locate it once with Glob pattern `**/.claude/skills/todo/todo.mjs` and remember the resolved path as `$TODO`. Then run all commands as `node $TODO <command> [args...]` via Bash from the project root. On error, the script prints to stderr and exits non-zero.

Current todo count: !`grep -c "^| [0-9]" TODO.md 2>/dev/null || echo "0 (no TODO.md)"`

---

## Operations

Determine the operation from the user's arguments or phrasing:

| User says | Operation |
|-----------|-----------|
| `/todo add ...` or "add a todo for ..." | **add** |
| `/todo list` or `/todo` (no args) or "list todos" or "show todos" | **list** |
| `/todo note <title or number> <text>` or "add a note to todo X" | **note** |
| `/todo work <title or number>` or "work on X" | **work** |
| `/todo log <title or number> <text>` or "log on todo X" | **log** |
| `/todo done <title or number>` or "mark X as done" | **done** |
| `/todo reopen <title or number>` or "reopen todo X" | **reopen** |
| `/todo remove <title or number>` or "delete todo X" | **remove** |
| `/todo test` or "test the todo skill" | **test** |

---

## ADD — Adding a new todo

### Step 1: Initialize and allocate

Run `node $TODO init` then `node $TODO next-id <title words>`. Parse output to get the 3-digit number and slug (e.g. `003 fix-login-bug`).

### Step 2: Determine priority

If the user provided a priority (e.g. "high priority", "P1", "low", "critical", "nice-to-have"), normalize to one of: `🔴 High` / `🟡 Medium` / `🟢 Low`. Map common variants: P1/critical/urgent → High, P2/normal → Medium, P3/nice-to-have/low → Low. If no priority given, use empty string.

### Step 3: Compose the detail file content

Before writing anything, compose the full detail file content while you have conversation context. The detail file must be **self-contained and actionable** for a future Claude session with zero prior context.

The detail file (`TODO/<NNN>-<slug>.md`) must include these sections:

**`## #<NNN> <Title>`** — one-sentence description of what needs to be done and why.

**`### Metadata`** — table with Created, Folder (`$PWD`), Project (basename or from package.json/pyproject.toml), Priority, Status (`Open`), Location (file:line if applicable) fields.

**`### Context`** — the full background. Mine the conversation thoroughly:
- Exact error messages, stack traces, log output
- File paths, function names, line numbers, code snippets examined
- Root cause analysis or hypotheses explored so far
- Related issues, PRs, docs, or external resources
- Constraints or requirements the user stated
- The user's original request or quote that prompted this todo
- Investigation already done (what was tried, found, ruled out)

**`### How to work on this`** — step-by-step guidance:
1. What to read first (specific files, functions, docs)
2. What the change or investigation should involve
3. Gotchas, known constraints, or things to watch out for
4. How to verify the work is done (test commands, manual checks)

**Do not summarize or abbreviate.** Zero information loss between conversation and detail file.

### Step 4: Write the files

1. Run `mkdir -p TODO` via Bash
2. Run `node $TODO add-row <NNN> <slug> "<title>" "<priority>" "<datetime>"` (get datetime from `node $TODO meta`)
3. Use `Write` to create `TODO/<NNN>-<slug>.md` with the composed detail content

See [examples.md](examples.md) for the complete detail file template.

---

## LIST — Showing todos

Run `node $TODO list` and display the output to the user. The script groups by status (Active, Open, Done) and formats a table. If no `TODO.md` exists, it reports that.

---

## DONE — Marking a todo complete

### Step 1: Identify the todo

Run `node $TODO rows` to get table rows. Find the matching todo by number or fuzzy title match (see [Matching rules](#matching-todos-by-number-or-text)).

**If no todo specified:** filter rows for non-done items. If exactly one exists, use it. If multiple, list them and ask the user.

### Step 2: Update TODO.md and move file

Get datetime from `node $TODO meta`.

1. Run `node $TODO done-row <NNN> "<datetime>"` — returns the slug
2. Run `node $TODO move-done <slug>`

### Step 3: Update detail file and compose Conclusion

Use `Edit` on `TODO/DONE/<NNN>-<slug>.md` to:
1. Change `Status` to `Done`
2. Add `| Completed | <datetime> |` to the Metadata table
3. Append `#### Conclusion` under `### Work Log` (create `### Work Log` first if needed)

Compose the Conclusion by mining the full conversation context:
- What was actually done — files changed, functions modified, approach taken
- Root cause (if investigative)
- Decisions made and why
- Deviations from the original plan
- Test results, build output, confirmation that the fix works
- Code snippets or diffs if they clarify the resolution

**Do not summarize briefly.** Write enough that someone reading only the Conclusion can understand what happened.

Conclusion format:
```markdown
#### Conclusion

**Completed:** <datetime>

<Full resolution narrative drawn from conversation context.>

***User note:*** <verbatim user-provided text, if any — omit if none>
```

---

## WORK — Starting work on a todo

### Step 1: Identify the todo

Run `node $TODO rows`. Fuzzy match to find the todo. Use `node $TODO find <NNN>` to get the file path.

### Step 2: Read and display

Read the detail file and display the full content to the user.

### Step 3: Update status

Run `node $TODO update-status <NNN> Active "<datetime>"`.

### Step 4: Update detail file

Use `Edit` on the detail file to:
1. Change `Status` from `Open` to `Active`
2. Append `### Work Log` (if not present) with a `#### Context and Plan` subsection:

```markdown
### Work Log

#### Context and Plan

**Active since:** <datetime>

<Plan of attack drawn from conversation context and "How to work on this" section.>
```

If `### Work Log` already exists, append a new `#### Context and Plan` entry.

### Step 5: Begin work

Say: "I'm ready to work on **#<NNN> <title>**." and outline next steps from the "How to work on this" section. Proceed to implement.

**Rules:** WORK does not mark done or move the file.

---

## NOTE — Adding a note to a todo

### Step 1: Identify the todo

Run `node $TODO rows`. Fuzzy match. Extract the file path from the matching row's link.

### Step 2: Compose and write the note

Get datetime and username from `node $TODO meta`.

Use `Edit` to locate or create `### Notes` (after `### How to work on this`), then append:

```markdown
#### <Short summary, 3-8 words>

**Added:** <datetime>

(@<username>) <user's text verbatim>

<Generated context paragraph — see below>
```

Add a generated context paragraph (without `(@username)`) if the conversation contains relevant specifics: error output, file paths, line numbers, code snippets, test results, connections to other work. Capture specifics, not summaries. Omit if no relevant context.

### Step 3: Update Changed date

Run `node $TODO update-status <NNN> <current-status> "<datetime>"`.

**Rules:** Always prefix user text with `(@username)`. Notes are append-only.

---

## LOG — Adding a log entry to a todo

Like NOTE, but the target section depends on the todo's state:
- **Open** → target `### Notes`
- **Active** or **Done** → target `### Work Log`

### Step 1: Identify the todo

Run `node $TODO rows`. Fuzzy match. Extract status and file path from the row.

### Step 2: Compose and write the entry

Same format as NOTE. Use `Edit` to append to the target section. When targeting `### Work Log`, append after existing subsections.

### Step 3: Update Changed date

Run `node $TODO update-status <NNN> <current-status> "<datetime>"`.

**Rules:** Same as NOTE — `(@username)` prefix, append-only.

---

## REOPEN — Reopening a completed todo

### Step 1: Identify the todo

Run `node $TODO find <NNN>`. Verify status is `Done ✓`. If not done, inform user and stop.

### Step 2: Update TODO.md and move file

Get datetime from `node $TODO meta`.

1. Run `node $TODO reopen-row <NNN> "<datetime>"` — returns the slug
2. Run `node $TODO move-open <slug>`

### Step 3: Update detail file

Use `Edit` on `TODO/<NNN>-<slug>.md` to:
1. Change `Status` from `Done` to `Open`
2. Remove the `| Completed | <datetime> |` row

**Rules:** Do NOT remove Work Log, Conclusion, or any history. The todo returns to `Open`, not `Active`.

---

## REMOVE — Deleting a todo

1. Run `node $TODO rows`. Fuzzy match to find the todo.
2. Run `node $TODO remove-row <NNN>` — outputs the file path
3. Delete the detail file via Bash: `rm <path>`
4. Confirm deletion to the user

**Note:** Do NOT renumber remaining todos or update the counter. Numbers are permanent.

---

## TEST — End-to-end skill test

Read [TEST.md](TEST.md) and follow the playbook instructions. This exercises all operations with 2 realistic todos through every state transition.

---

## Matching todos by number or text

When a user references a todo, they may use:
- A number: `1`, `001`, `#1`, `#001` — match against the No column
- Title text: `csv parser`, `login bug` — fuzzy match against the Title column

**Matching rules:**
1. Try numeric match first: strip `#`, convert to integer, use `node $TODO find <number>`
2. If no numeric match or the argument contains non-numeric characters, run `node $TODO rows` and do a case-insensitive substring match on the title text
3. If multiple matches, show them and ask the user to be more specific

---

## File format rules

- **`TODO.md`** contains ONLY: headings, the table, the `---` separator, `<!-- next: N -->` counter, and `<!-- skill: SHA -->` version comment
- **`TODO/<NNN>-<slug>.md`** — open/active todo detail files
- **`TODO/DONE/<NNN>-<slug>.md`** — completed todo detail files
- Numbers are permanent — never renumber. Always use the counter for new todos.
- Status flow: `Open` → `Active` (work) → `Done` (done) → `Open` (reopen). In TODO.md done status is `Done ✓`.
- Subsection order in detail files: Metadata, Context, How to work on this, Notes, Work Log (last)
- Preserve all existing content when editing

For complete format templates, see [examples.md](examples.md).

---

## Migrations

`TODO.md` tracks the skill version via `<!-- skill: SHA -->`. On any operation, if the SHA doesn't match the current skill version, read [MIGRATIONS.md](MIGRATIONS.md) for migration steps. Apply them in order, then update the SHA.

If no `<!-- skill: SHA -->` comment exists, just add it. No migration needed.
