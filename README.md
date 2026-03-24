# todo-skill

A [Claude Code](https://claude.com/claude-code) skill that manages a local `TODO.md` file with rich context tracking.

## What it does

`/todo` gives you a structured, Markdown-based task list using a **split-file architecture**:

- **`TODO.md`** — A lightweight index file containing a numbered table of todos (number, title, priority, status, dates) and an auto-incrementing counter
- **`TODO/<NNN>-<slug>.md`** — One file per todo (in a `TODO/` subdirectory) with full metadata, context, step-by-step guidance, notes, and resolution
- **`TODO/DONE/`** — Completed todo files are moved here

Human-readable, git-friendly, and designed so a future Claude session can pick up any todo and immediately know what to do.

## Why split files?

A single `TODO.md` that contains both the task list and all detail sections has a scaling problem: every operation loads the entire file into Claude's context window, even when most of the content is irrelevant. Adding a todo requires reading every other todo's full context. Listing tasks pulls in hundreds of lines of detail you'll never display.

The split-file architecture solves this:

- **LIST** greps only table rows from `TODO.md` — never loads detail content
- **WORK** reads only the single `<NNN>-<slug>.md` file it needs
- **ADD / DONE / NOTE / LOG** use targeted edits on specific files — no need to read or load unrelated todos

This means the skill stays fast and context-efficient regardless of how many todos you accumulate. A `TODO.md` with 50 items is just a 50-row table, not 50 full detail sections.

**Trade-off:** slightly more files on disk. But each file is small, independently readable, and diffs cleanly in git.

## Directory structure

```
project/
  TODO.md                                    # Index: numbered table + counter
  TODO/
    DONE/
      001-fix-login-bug-on-oauth-flow.md     # Completed todo #001
    002-add-unit-tests-for-parser-module.md  # Open todo #002
```

## Commands

| Command | Description |
|---------|-------------|
| `/todo add <description>` | Add a new todo with context from the conversation |
| `/todo list` | Show all todos with number, priority, status, and dates |
| `/todo note <# or title> <text>` | Append a timestamped note to Notes section |
| `/todo work <# or title>` | Set to Active, record work context, and start working |
| `/todo log <# or title> <text>` | Like note, but appends to Work Log when Active/Done |
| `/todo done <# or title>` | Mark complete, record findings, move to DONE/ |
| `/todo reopen <# or title>` | Move a done todo back to Open, restore to TODO/ |
| `/todo remove <# or title>` | Delete a todo |

## Features

- **Auto-incrementing numbers** — each todo gets a permanent 3-digit number (`001`, `002`, ...) tracked by a counter in `TODO.md`
- **Table index** — `TODO.md` shows todos in a table with No, Title, Priority, Status, Created, and Changed columns
- **Priority badges** — `🔴 High` / `🟡 Medium` / `🟢 Low`, visible in the table
- **Rich context** — captures error messages, file locations, related issues, and conversation context
- **Actionable guidance** — each todo has a "How to work on this" section with step-by-step instructions
- **Timestamped notes** — append notes as `####` subsections with `**Added:**` datetime and `(@username)` attribution
- **Log entries** — like notes, but routed to Work Log when the todo is Active or Done, keeping work-related observations with the work history
- **Active state** — `work` transitions a todo to Active and records a "Context and Plan" subsection under Work Log with the plan of attack
- **Work log tracking** — structured Work Log section with `Context and Plan` (from work), log entries, and `Conclusion` (from done) subsections. The detail file is moved to `DONE/` only when marked done
- **Reopen** — move a completed todo back to Open state, restoring the file from `DONE/` while preserving all history
- **Metadata** — creation datetime, folder, project, file location, status
- **Flexible referencing** — reference todos by number (`/todo work 1`, `/todo work #001`) or by text (`/todo work csv parser`) — numbers are supported but optional
- **Legacy migration** — automatically migrates existing bullet-list or single-file `TODO.md` to the numbered table format on first use

## Usage recommendation

This skill writes `TODO.md` and `TODO/` directly into your project directory — right next to your code. The idea is to manage todos where the work happens, so every task carries full context about the specific project it belongs to.

Whether you commit these files to git or treat them as local scratch files is up to you:

- **Track in git** — useful for shared projects where teammates (or future you) should see what's open, what was tried, and how things were resolved. The Markdown format diffs cleanly and is readable on GitHub.
- **Keep local only** — add `TODO.md` and `TODO/` to `.gitignore` if you just want a personal task list that lives alongside the code without cluttering the repo.

Either way, the files are plain Markdown and always human-readable.

## Installation

Copy the skill directory into your Claude Code skills directory:

```bash
mkdir -p ~/.claude/skills/todo
cp .claude/skills/todo/SKILL.md ~/.claude/skills/todo/SKILL.md
cp .claude/skills/todo/examples.md ~/.claude/skills/todo/examples.md
```

Then use `/todo` in any Claude Code session.

## Example

**`TODO.md`** — the index file:

```markdown
# TODO

## Tasks

| No | Title | Priority | Status | Created | Changed |
|----|-------|----------|--------|---------|---------|
| 001 | [Fix rate limiter bypassing auth endpoints](TODO/001-fix-rate-limiter-bypassing-auth-endpoints.md) | 🔴 High | Open | 2026-03-22 09:45 | 2026-03-22 09:45 |
| 002 | [Add dark mode to settings](TODO/002-add-dark-mode-to-settings.md) | 🟡 Medium | Open | 2026-03-22 10:30 | 2026-03-22 10:30 |

---
<!-- next: 3 -->
```

**`TODO/001-fix-rate-limiter-bypassing-auth-endpoints.md`** — full detail:

```markdown
## #001 Fix rate limiter bypassing auth endpoints

The rate limiter skips `/auth/` routes, allowing brute-force attacks.

### Metadata

| Field    | Value |
|----------|-------|
| Created  | 2026-03-22 09:45 |
| Folder   | `/Users/alice/projects/myapp` |
| Project  | myapp |
| Priority | 🔴 High |
| Status   | Open |
| Location | `src/middleware/rateLimiter.ts:23` |

### Context

Security audit flagged the allowlist on line 23...

### How to work on this

1. Read `src/middleware/rateLimiter.ts`...

### Notes

#### Found during Q1 audit

**Added:** 2026-03-22 10:15

(@alice) Needs to be fixed before the audit report is finalized next week.
```

## Sample conversation

Here's a typical workflow showing how the commands work together:

```
You:  The CSV parser crashes on files with semicolon delimiters.
      Can you take a look at src/parser/csv.ts?

Claude: [reads the file, investigates the issue]
        The parser hardcodes comma as the delimiter on line 14...

You:  /todo add Fix CSV parser to support semicolon delimiters — critical for EU customers, P1

Claude: Added todo #001 "Fix CSV parser to support semicolon delimiters" 🔴 High
        with context from our investigation (file location, root cause, etc.)
```

```
You:  /todo note csv parser Alice confirmed we also need tab-delimited support for the Japan team

Claude: Added note to #001 "Fix CSV parser to support semicolon delimiters".
```

```
You:  /todo work 1

Claude: [displays the full context, metadata, and guidance]
        [sets status to Active, records Context and Plan in Work Log section]
        I'm ready to work on #001 "Fix CSV parser to support semicolon delimiters".
        Based on the context above, here's my plan:
        1. Refactor the delimiter to be configurable...
        2. ...

        [starts implementing the fix]
```

```
You:  /todo log 1 Auto-detection works but fails on mixed-delimiter files

Claude: Added log entry to #001's Work Log: "Auto-detection fails on mixed delimiters".
```

```
You:  /todo done 1 Ended up using a delimiter auto-detection approach instead of config

Claude: Marked #001 "Fix CSV parser to support semicolon delimiters" as done ✓
        Conclusion recorded and file moved to DONE/.
```

```
You:  /todo reopen 1

Claude: Reopened #001 "Fix CSV parser to support semicolon delimiters" — moved back to TODO/.
```

```
You:  /todo list

Claude: Todos in TODO.md:

          No   Title                                              Priority   Status    Created            Changed
          001  Fix CSV parser to support semicolon delimiters     🔴 High    Open      2026-03-22 09:45   2026-03-22 15:00
          002  Add retry logic to webhook delivery                🟡 Medium  Active    2026-03-22 11:00   2026-03-22 13:00
          003  Update API docs                                               Open      2026-03-22 14:00   2026-03-22 14:00
```

Each todo captures enough context that a future Claude session — or another developer — can pick it up and immediately know what to do, why, and how.

## License

MIT
