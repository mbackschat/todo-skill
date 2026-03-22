---
name: todo
description: This skill manages a local TODO.md task list with rich context tracking. Use when the user says "/todo", "add a todo", "mark todo as done", "list todos", "work on todo", "show todos", "add a note to todo", or asks to track, capture, or manage tasks in a TODO list.
argument-hint: <add|list|done|work|note|remove> [todo title or number]
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# TODO Manager

Manage a structured, Markdown-based task list using a **split-file architecture**:

- **`TODO.md`** — A lightweight index containing only the bullet list of todos
- **`TODO/`** — A sibling directory where each todo has its own `<slug>.md` file with full context, metadata, and guidance

```
project/
  TODO.md                                # Index: bullet list only
  TODO/
    fix-login-bug-on-oauth-flow.md       # Detail for todo 1
    add-unit-tests-for-parser-module.md  # Detail for todo 2
```

This split keeps todo details out of Claude's context window when they aren't needed. LIST only greps bullet lines; WORK reads a single detail file; write operations use targeted edits.

Current todo count: !`grep -c "^- \[" TODO.md 2>/dev/null || echo "0 (no TODO.md)"`

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

### Step 1: Build the anchor slug

Create a URL-safe anchor slug from the title:
- Lowercase, replace spaces with `-`, strip special characters
- Example: "Fix login bug" → `fix-login-bug`
- If a slug already exists (check `TODO.md` bullet lines and files in `TODO/`), append `-2`, `-3`, etc.

### Step 2: Determine priority/relevancy

If the user provided a priority or relevancy level (e.g. "high priority", "P1", "low", "critical", "nice-to-have"), normalize it to one of:
- `🔴 High` / `🟡 Medium` / `🟢 Low`

Map common variants: P1/critical/urgent → High, P2/normal → Medium, P3/nice-to-have/low → Low.

If no priority given, omit the badge entirely (do not default to Medium).

### Step 3: Collect metadata

Gather from the current context:
- **Created**: current date and time (ISO 8601, e.g. `2026-03-22 14:30`). To get the current time, run `date '+%Y-%m-%d %H:%M'` via Bash.
- **Folder**: the current working directory (use `$PWD` or the active project path)
- **Project**: the repository or project name (basename of the folder, or from `package.json`/`pyproject.toml` if present)
- **File / Location**: if the todo is about a specific file, function, or line range, record it
- Any other relevant context from the conversation (related issue numbers, PR links, error messages, commands that triggered this, etc.)

### Step 4: Compose the detail file content

Before writing anything, compose the full detail file content while you have conversation context. This is the most important step — the detail file must be **self-contained and actionable** for a future Claude session with zero prior context.

The detail file (`TODO/<slug>.md`) must include these sections:

**`## <Title>`** — one-sentence description of what needs to be done and why.

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

### Step 5: Write the files

1. Create `TODO/` directory if it doesn't exist (`mkdir -p TODO`)
2. If `TODO.md` doesn't exist, create it with the skeleton below
3. Use `Edit` to insert the bullet line before the `---` separator in `TODO.md`:
   ```
   - [<summary>](#<slug>) <priority-badge-if-any>
   ```
4. Use `Write` to create `TODO/<slug>.md` with the composed detail content

`TODO.md` skeleton (used only when creating a new file):
```markdown
# TODO

## Tasks

---
```

**Note:** When adding the first todo to a freshly created file, insert the bullet item on a blank line directly above the `---` separator. Never leave placeholder comments in the file.

---

## LIST — Showing todos

1. Check if `TODO.md` exists; if not, say "No TODO.md found."
2. Use `Grep` with pattern `^- \[` on `TODO.md` to extract only the bullet lines — do NOT read the whole file
3. Parse each bullet line to extract: title, priority badge, done status (strikethrough + checkmark)
4. Display a formatted summary:

```
Open todos in TODO.md:

  #  Title                                   Priority   Status
  1  Fix login bug on OAuth flow             🔴 High    Done ✓
  2  Add unit tests for parser module        🟢 Low     Open
```

Group by status (Open first, then Done). If the file doesn't exist, say so.

---

## DONE — Marking a todo complete

### Step 1: Identify the todo

Use `Grep` with pattern `^- \[` on `TODO.md` to get the bullet lines. Find the matching todo by number or fuzzy title match. Extract the slug from the anchor link `(#<slug>)`.

### Step 2: Update TODO.md

Use `Edit` to add `~~strikethrough~~` around the link text of the matching bullet and append ` ✓`.

### Step 3: Update the detail file

Use `Edit` on `TODO/<slug>.md` to:
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

**Rules:**
- Always generate a resolution from conversation context. If no context is available, write "No conversation context available — marked done manually."
- If the user supplied text alongside the done command, include it verbatim as `***User note:***`. Never paraphrase.
- If no user text was given, omit `***User note:***` entirely.

---

## WORK — Starting work on a todo

1. Use `Grep` with pattern `^- \[` on `TODO.md` to get the bullet lines
2. Find the matching todo (by number or fuzzy title match)
3. Extract the slug from the anchor link `(#<slug>)`
4. Read `TODO/<slug>.md` and display the full detail section to the user
5. Say: "I'm ready to work on **<title>**. Based on the context above, here's my plan:" and outline the next steps from the "How to work on this" section.
6. Proceed to implement or investigate as guided by the section.

---

## NOTE — Adding a note to a todo

### Step 1: Identify the todo

Use `Grep` with pattern `^- \[` on `TODO.md` to get the bullet lines. Find the matching todo by number or fuzzy title match. Extract the slug from the anchor link.

### Step 2: Compose and write the note

Get the current datetime via `date '+%Y-%m-%d %H:%M'` and the username via `whoami`.

Use `Edit` on `TODO/<slug>.md` to locate or create the `### Notes` subsection (after `### How to work on this`), then append the new note entry:

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

**Rules:**
- Always mark user-provided text with `(@username)` at the start
- If the user provides no text but asks to "add a note", prompt them for what to write
- If the user provides text but no conversation context is relevant, omit the generated paragraph
- Notes are append-only — never edit or remove existing notes

`TODO.md` is not modified for NOTE operations.

---

## REMOVE — Deleting a todo

1. Use `Grep` with pattern `^- \[` on `TODO.md` to get the bullet lines
2. Find the matching todo and extract the slug
3. Edit `TODO.md` to remove the bullet line
4. Delete `TODO/<slug>.md` via Bash (`rm TODO/<slug>.md`)
5. Confirm deletion to the user

---

## File format rules

- **`TODO.md`** contains ONLY: `# TODO` heading, `## Tasks` bullet list, and the `---` separator. No detail sections.
- **`TODO/<slug>.md`** contains a single todo's detail section, starting with `## <Title>`. One file per todo.
- The `TODO/` directory is a sibling of `TODO.md` (same parent directory).
- Slug derivation: lowercase, replace spaces with `-`, strip special characters. Used for both anchor links and filenames.
- Subsection order within a detail file:
  1. `### Metadata`
  2. `### Context`
  3. `### How to work on this`
  4. `### Notes` (last for open todos — easy to append to)
  5. `### Resolution` (only when done — always the very last subsection)
- Never renumber or reorder existing bullet entries; always append new ones
- Preserve all existing content when editing

For complete format templates and examples, see [examples.md](examples.md).

---

## Migration from single-file format

If `TODO.md` exists and contains `## ` headings after the `---` separator, it uses the legacy single-file format. On the first operation, migrate automatically:

1. Read the full `TODO.md`
2. Split content after the `---` separator on `## ` headings to extract each detail section
3. Create `TODO/` directory
4. For each detail section, derive the slug from the heading and write `TODO/<slug>.md`
5. Truncate `TODO.md` to keep only `# TODO`, `## Tasks`, the bullet list, and the `---` separator
6. Inform the user: "Migrated N todos to split-file format (`TODO/` directory created)."

Migration is idempotent — if `TODO/` already exists with matching files, skip.
