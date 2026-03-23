---
name: todo
description: This skill manages a local TODO.md task list with rich context tracking. Use when the user says "/todo", "add a todo", "mark todo as done", "list todos", "work on todo", "show todos", "add a note to todo", or asks to track, capture, or manage tasks in a TODO list.
argument-hint: <add|list|done|work|note|remove> [todo title or number]
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# TODO Manager

Manage a structured, Markdown-based task list using a **split-file architecture**:

- **`TODO.md`** — A lightweight index containing a numbered table of todos and a counter
- **`TODO/`** — A sibling directory where each todo has its own `<NNN>-<slug>.md` file with full context, metadata, and guidance

```
project/
  TODO.md                                    # Index: numbered table + counter
  TODO/
    DONE/
      001-fix-login-bug-on-oauth-flow.md     # Completed todo #001
    002-add-unit-tests-for-parser-module.md  # Open todo #002
```

This split keeps todo details out of Claude's context window when they aren't needed. LIST only greps table rows; WORK reads a single detail file; write operations use targeted edits.

Current todo count: !`grep -c "^| [0-9]" TODO.md 2>/dev/null || echo "0 (no TODO.md)"`

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

### Step 1: Allocate the next number

Read `TODO.md` and extract the counter from the `<!-- next: N -->` comment at the end of the file. If `TODO.md` doesn't exist, start at `1`. Pad the number to 3 digits (e.g. `1` → `001`, `42` → `042`).

### Step 2: Build the anchor slug

Create a URL-safe anchor slug from the title:
- Lowercase, replace spaces with `-`, strip special characters
- Prepend the 3-digit number: `<NNN>-<title-slug>`
- Example: number 3, title "Fix login bug" → `003-fix-login-bug`
- If a slug already exists (check `TODO.md` table rows and files in `TODO/`), append `-2`, `-3`, etc. to the title portion

### Step 3: Determine priority/relevancy

If the user provided a priority or relevancy level (e.g. "high priority", "P1", "low", "critical", "nice-to-have"), normalize it to one of:
- `🔴 High` / `🟡 Medium` / `🟢 Low`

Map common variants: P1/critical/urgent → High, P2/normal → Medium, P3/nice-to-have/low → Low.

If no priority given, omit the badge entirely (leave the Priority cell empty).

### Step 4: Collect metadata

Gather from the current context:
- **Created**: current date and time (ISO 8601, e.g. `2026-03-22 14:30`). To get the current time, run `date '+%Y-%m-%d %H:%M'` via Bash.
- **Folder**: the current working directory (use `$PWD` or the active project path)
- **Project**: the repository or project name (basename of the folder, or from `package.json`/`pyproject.toml` if present)
- **File / Location**: if the todo is about a specific file, function, or line range, record it
- Any other relevant context from the conversation (related issue numbers, PR links, error messages, commands that triggered this, etc.)

### Step 5: Compose the detail file content

Before writing anything, compose the full detail file content while you have conversation context. This is the most important step — the detail file must be **self-contained and actionable** for a future Claude session with zero prior context.

The detail file (`TODO/<NNN>-<slug>.md`) must include these sections:

**`## #<NNN> <Title>`** — one-sentence description of what needs to be done and why.

**`### Metadata`** — table with Created, Folder, Project, Priority, Status, Location fields.

**`### Context`** — the full background. Mine the conversation thoroughly and include:
- The exact error messages, stack traces, or log output discussed
- Specific file paths, function names, line numbers, and code snippets examined
- Root cause analysis or hypotheses explored so far
- Related issues, PRs, docs, or external resources mentioned
- Constraints or requirements the user stated
- The user's original request or the quote that prompted this todo
- Any investigation already done (what was tried, what was found, what was ruled out)

**`### How to work on this`** — step-by-step guidance:
1. What to read first (specific files, functions, docs)
2. What the change or investigation should involve
3. Gotchas, known constraints, or things to watch out for
4. How to verify the work is done (test commands, manual checks)

**Do not summarize or abbreviate.** If the conversation includes a 10-line stack trace, include the full stack trace. If three files were investigated, list all three with what was found in each. The goal is zero information loss between the current conversation and the detail file.

### Step 6: Write the files

1. Create `TODO/` directory if it doesn't exist (`mkdir -p TODO`)
2. If `TODO.md` doesn't exist, create it with the skeleton below
3. Use `Edit` to insert the table row before the empty line preceding the `---` separator in `TODO.md`:
   ```
   | <NNN> | [<summary>](TODO/<NNN>-<slug>.md) | <priority-badge-or-empty> | Open | <datetime> | <datetime> |
   ```
4. Use `Edit` to update the counter: replace `<!-- next: N -->` with `<!-- next: N+1 -->`
5. Use `Write` to create `TODO/<NNN>-<slug>.md` with the composed detail content

`TODO.md` skeleton (used only when creating a new file):
```markdown
# TODO

## Tasks

| No | Title | Priority | Status | Created | Changed |
|----|-------|----------|--------|---------|---------|

---
<!-- next: 1 -->
```

**Note:** When adding the first todo, insert the table row after the header separator line (`|----|-...`). The `Created` and `Changed` columns use `YYYY-MM-DD HH:MM` datetime format, matching the detail files.

---

## LIST — Showing todos

1. Check if `TODO.md` exists; if not, say "No TODO.md found."
2. Use `Grep` with pattern `^\| \d{3} \|` on `TODO.md` to extract only the table data rows — do NOT read the whole file
3. Parse each row to extract: number, title, priority badge, status
4. Display a formatted summary:

```
Todos in TODO.md:

  No   Title                                   Priority   Status    Created      Changed
  001  Fix login bug on OAuth flow             🔴 High    Done ✓    2026-03-22 09:45   2026-03-22 17:30
  002  Add unit tests for parser module        🟢 Low     Open      2026-03-22 11:00   2026-03-23 15:45
```

Group by status (Open first, then Done). If the file doesn't exist, say so.

---

## DONE — Marking a todo complete

### Step 1: Identify the todo

Use `Grep` with pattern `^\| \d{3} \|` on `TODO.md` to get the table rows. Find the matching todo by number or fuzzy title match. Extract the slug from the file link `(TODO/<NNN>-<slug>.md)`.

The user may refer to a todo by its number (e.g. `1`, `001`, or `#001`) or by title text (e.g. `csv parser`). Try number match first, then fall back to fuzzy title match.

### Step 2: Update TODO.md

Use `Edit` to modify the matching table row:
1. Add `~~strikethrough~~` around the link text
2. Change the Status cell to `Done ✓`
3. Update the Changed datetime to the current datetime

### Step 3: Update the detail file

Use `Edit` on `TODO/<NNN>-<slug>.md` to:
1. Change `Status` from `Open` to `Done`
2. Add `| Completed | <datetime> |` row to the Metadata table
3. Append the Resolution subsection at the end of the file

Compose the Resolution subsection by mining the full conversation context. Include:
- What was actually done — files changed, functions modified, approach taken, commands run
- What the root cause turned out to be (if investigative)
- Decisions made and why (e.g. "chose approach X over Y because...")
- Anything that deviated from the original "How to work on this" plan
- Relevant output: test results, build output, or confirmation that the fix works
- Code snippets or diffs if they clarify the resolution

**Do not summarize briefly.** A one-sentence resolution like "Fixed the bug" is not acceptable. Write enough that someone reading only the resolution can understand what happened without re-reading the conversation.

Resolution format:
```markdown
### Resolution

**Completed:** <current datetime, e.g. 2026-03-22 16:45>

<Full resolution narrative drawn from conversation context.>

***User note:*** <verbatim user-provided text, if any>
```

### Step 4: Move the detail file to DONE/

1. Create the `TODO/DONE/` directory if it doesn't exist: `mkdir -p TODO/DONE`
2. Move the file via Bash: `mv TODO/<NNN>-<slug>.md TODO/DONE/<NNN>-<slug>.md`
3. Use `Edit` on `TODO.md` to update the link in the matching table row from `(TODO/<NNN>-<slug>.md)` to `(TODO/DONE/<NNN>-<slug>.md)`

**Rules:**
- Always generate a resolution from conversation context. If no context is available, write "No conversation context available — marked done manually."
- If the user supplied text alongside the done command, include it verbatim as `***User note:***`. Never paraphrase.
- If no user text was given, omit `***User note:***` entirely.

---

## WORK — Starting work on a todo

1. Use `Grep` with pattern `^\| \d{3} \|` on `TODO.md` to get the table rows
2. Find the matching todo (by number or fuzzy title match)
3. Extract the file path from the link in the Title cell (may be `TODO/<NNN>-<slug>.md` or `TODO/DONE/<NNN>-<slug>.md`)
4. Read the detail file at the extracted path and display the full detail section to the user
5. Say: "I'm ready to work on **#<NNN> <title>**. Based on the context above, here's my plan:" and outline the next steps from the "How to work on this" section.
6. Proceed to implement or investigate as guided by the section.

---

## NOTE — Adding a note to a todo

### Step 1: Identify the todo

Use `Grep` with pattern `^\| \d{3} \|` on `TODO.md` to get the table rows. Find the matching todo by number or fuzzy title match. Extract the file path from the link in the Title cell (may be `TODO/<NNN>-<slug>.md` or `TODO/DONE/<NNN>-<slug>.md`).

### Step 2: Compose and write the note

Get the current datetime via `date '+%Y-%m-%d %H:%M'` and the username via `whoami`.

Use `Edit` on the extracted file path to locate or create the `### Notes` subsection (after `### How to work on this`), then append the new note entry:

```markdown
#### <Short summary, 3-8 words> (<datetime>)

(@<username>) <user's text verbatim>

<Generated context paragraph — see below>
```

After the user's verbatim text, add a generated context paragraph (without `(@username)` prefix) if the conversation contains relevant information that enriches the note. This includes:
- Error output, test results, or command output from the current session
- Findings from file reads or code investigation done in this conversation
- Code snippets, file paths, or line numbers discovered during the discussion
- Connections to other todos, issues, or prior work discussed

The generated paragraph should capture specifics, not summaries. If you investigated a file and found the relevant line, include the file path and line number. If a test failed with a specific error, include the error.

### Step 3: Update the Changed date in TODO.md

Use `Edit` to update the Changed column of the matching table row to the current datetime.

**Rules:**
- Always mark user-provided text with `(@username)` at the start
- If the user provides no text but asks to "add a note", prompt them for what to write
- If the user provides text but no conversation context is relevant, omit the generated paragraph
- Notes are append-only — never edit or remove existing notes

---

## REMOVE — Deleting a todo

1. Use `Grep` with pattern `^\| \d{3} \|` on `TODO.md` to get the table rows
2. Find the matching todo and extract the file path from the link (may be `TODO/<NNN>-<slug>.md` or `TODO/DONE/<NNN>-<slug>.md`)
3. Edit `TODO.md` to remove the table row
4. Delete the detail file at the extracted path via Bash (`rm <path>`)
5. Confirm deletion to the user

**Note:** Do NOT renumber remaining todos or update the counter. Numbers are permanent identifiers.

---

## Matching todos by number or text

When a user references a todo, they may use:
- A number: `1`, `001`, `#1`, `#001` — match against the No column
- Title text: `csv parser`, `login bug` — fuzzy match against the Title column

**Matching rules:**
1. Try numeric match first: strip `#` prefix, convert to integer, pad to 3 digits, find the row starting with `| <NNN> |`
2. If no numeric match or the argument contains non-numeric characters, fall back to fuzzy title match using case-insensitive substring search
3. If multiple matches found, show the matches and ask the user to be more specific

---

## File format rules

- **`TODO.md`** contains ONLY: `# TODO` heading, `## Tasks` heading, the table (header + data rows), the `---` separator, and the `<!-- next: N -->` counter comment. No detail sections.
- **`TODO/<NNN>-<slug>.md`** contains an open todo's detail section, starting with `## #<NNN> <Title>`. One file per todo.
- **`TODO/DONE/<NNN>-<slug>.md`** contains a completed todo's detail section. When a todo is marked done, its file is moved from `TODO/` to `TODO/DONE/`.
- The `TODO/` directory is a sibling of `TODO.md` (same parent directory). `TODO/DONE/` is a subdirectory of `TODO/`.
- Slug derivation: 3-digit number prefix, then lowercase title with spaces replaced by `-` and special characters stripped. Used for both file links and filenames.
- Numbers are permanent — never renumber or reorder existing rows. Always use the next counter value for new todos.
- Subsection order within a detail file:
  1. `### Metadata`
  2. `### Context`
  3. `### How to work on this`
  4. `### Notes` (last for open todos — easy to append to)
  5. `### Resolution` (only when done — always the very last subsection)
- Preserve all existing content when editing

For complete format templates and examples, see [examples.md](examples.md).

---

## Migration from single-file format

If `TODO.md` exists and contains `## ` headings after the `---` separator, it uses the legacy single-file format. On the first operation, migrate automatically:

1. Read the full `TODO.md`
2. Split content after the `---` separator on `## ` headings to extract each detail section
3. Create `TODO/` directory
4. For each detail section, assign incrementing numbers starting at `001`, derive the slug from the heading, and write `TODO/<NNN>-<slug>.md` (updating the heading to `## #<NNN> <Title>`)
5. Replace the bullet list with a table and add the `<!-- next: N+1 -->` counter
6. Inform the user: "Migrated N todos to split-file format (`TODO/` directory created)."

### Migration from bullet-list index format

If `TODO.md` exists and contains bullet lines (`- [`) instead of a table, migrate the index:

1. Parse each bullet line to extract: title, slug, priority, done status
2. Assign incrementing numbers starting at `001`
3. Rename each `TODO/<old-slug>.md` to `TODO/<NNN>-<old-slug>.md` and update the heading to `## #<NNN> <Title>`
4. Replace the bullet list with the table format and add the counter
5. Inform the user: "Migrated TODO.md index to numbered table format."

Migration is idempotent — if the table format and counter already exist, skip.

### Migration of done todos to DONE/ subfolder

If `TODO.md` has rows with status `Done ✓` whose links still point to `TODO/<NNN>-<slug>.md` (not `TODO/DONE/`), migrate on the first operation:

1. Create `TODO/DONE/` directory if it doesn't exist
2. For each done row: move `TODO/<NNN>-<slug>.md` to `TODO/DONE/<NNN>-<slug>.md` and update the link in `TODO.md`
3. Inform the user: "Moved N completed todo(s) to TODO/DONE/."
