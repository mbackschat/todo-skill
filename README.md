# todo-skill

A [Claude Code](https://claude.com/claude-code) skill that manages a local `TODO.md` file with rich context tracking.

## What it does

`/todo` gives you a structured, Markdown-based task list where each todo has:

- A **bullet list entry** with summary, priority badge, and anchor link
- A **detail section** with metadata, full context, step-by-step guidance, notes, and resolution

Everything lives in a single `TODO.md` file in your working directory — human-readable, git-friendly, and designed so a future Claude session can pick up any todo and immediately know what to do.

## Commands

| Command | Description |
|---------|-------------|
| `/todo add <description>` | Add a new todo with context from the conversation |
| `/todo list` | Show all todos with priority and status |
| `/todo done <# or title>` | Mark complete with a resolution summary |
| `/todo work <# or title>` | Read the context and start working on it |
| `/todo note <# or title> <text>` | Append a timestamped note |
| `/todo remove <# or title>` | Delete a todo |

## Features

- **Priority badges** — `🔴 High` / `🟡 Medium` / `🟢 Low`, filterable in the task list
- **Rich context** — captures error messages, file locations, related issues, and conversation context
- **Actionable guidance** — each todo has a "How to work on this" section with step-by-step instructions
- **Timestamped notes** — append notes as `####` subsections with `(@username)` attribution
- **Resolution tracking** — when marking done, a resolution summary is generated from conversation context, with user notes preserved verbatim
- **Metadata** — creation datetime, folder, project, file location, status
- **Fuzzy matching** — reference todos by number or by text; `/todo work csv parser` finds "Fix CSV parser to support semicolon delimiters"

## Installation

Copy `SKILL.md` into your Claude Code skills directory:

```bash
mkdir -p ~/.claude/skills/todo
cp SKILL.md ~/.claude/skills/todo/SKILL.md
```

Then use `/todo` in any Claude Code session.

## Example

```markdown
## Tasks

- [Fix rate limiter bypassing auth endpoints](#fix-rate-limiter-bypassing-auth-endpoints) 🔴 High
- [Add dark mode to settings](#add-dark-mode-to-settings) 🟡 Medium

---

## Fix rate limiter bypassing auth endpoints

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

#### Found during Q1 audit (2026-03-22 10:15)

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

Claude: Added todo "Fix CSV parser to support semicolon delimiters" 🔴 High
        with context from our investigation (file location, root cause, etc.)
```

```
You:  /todo note csv parser Alice confirmed we also need tab-delimited support for the Japan team

Claude: Added note to "Fix CSV parser to support semicolon delimiters".
```

```
You:  /todo work csv parser

Claude: [displays the full context, metadata, and guidance]
        I'm ready to work on "Fix CSV parser to support semicolon delimiters".
        Based on the context above, here's my plan:
        1. Refactor the delimiter to be configurable...
        2. ...

        [starts implementing the fix]
```

```
You:  /todo done csv parser Ended up using a delimiter auto-detection approach instead of config

Claude: Marked "Fix CSV parser to support semicolon delimiters" as done ✓
        Resolution recorded with implementation details from this session.
```

```
You:  /todo work retry logic

Claude: [displays the full context, metadata, and guidance]
        I'm ready to work on "Add retry logic to webhook delivery".
        Based on the context above, here's my plan:
        1. Read the current webhook delivery code...
        2. Add exponential backoff with jitter...
        3. ...

        [starts implementing]
```

```
You:  /todo list

Claude: Open todos in TODO.md:

          #  Title                                              Priority   Status
          1  Fix CSV parser to support semicolon delimiters     🔴 High    Done ✓
          2  Add retry logic to webhook delivery                🟡 Medium  Open
```

Each todo captures enough context that a future Claude session — or another developer — can pick it up and immediately know what to do, why, and how.

## License

MIT
