# Migrations

Ordered list of skill changes that require migration of existing TODO.md and detail files. Each entry lists:
- The commit SHA that introduced the change
- What changed
- How to migrate

Apply migrations in order from the SHA recorded in `<!-- skill: SHA -->` to the current version. After applying, update the `<!-- skill: SHA -->` comment to the current version.

---

## `PENDING` — Add `todo.mjs` helper script

**What changed:** Mechanical operations (table manipulation, counter, slug generation, file moves) are now handled by `todo.mjs`, a cross-platform Node.js script. No changes to the TODO.md or detail file formats.

**Migration:** No file format changes. Just update `<!-- skill: SHA -->` to the current version.
