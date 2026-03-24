#!/usr/bin/env node

// Cross-platform helper script for the /todo skill.
// Handles mechanical TODO.md operations (table manipulation, counter, file moves).
// Zero dependencies — uses only Node.js built-ins.

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { userInfo } from 'os';

const TODO_FILE = 'TODO.md';
const TODO_DIR = 'TODO';
const DONE_DIR = join('TODO', 'DONE');

const SKELETON = `# TODO

## Tasks

| No | Title | Priority | Status | Created | Changed |
|----|-------|----------|--------|---------|---------|

---
<!-- next: 1 -->
<!-- skill: CURRENT -->
`;

// --- Helpers ---

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function readTodo() {
  if (!existsSync(TODO_FILE)) die('TODO.md not found (run init first)');
  return readFileSync(TODO_FILE, 'utf8');
}

function writeTodo(content) {
  writeFileSync(TODO_FILE, content, 'utf8');
}

/** Parse table data rows from TODO.md content. Returns array of raw row strings. */
function parseRows(content) {
  return content.split('\n').filter(line => /^\| \d{3} \|/.test(line));
}

/** Parse a single table row into structured fields. */
function parseRow(row) {
  const cells = row.split('|').map(c => c.trim()).filter(Boolean);
  // cells: [number, title-link, priority, status, created, changed]
  const number = cells[0];
  const titleCell = cells[1];

  // Extract title and path from markdown link: [text](path) or [~~text~~](path)
  const linkMatch = titleCell.match(/^\[(?:~~)?(.+?)(?:~~)?\]\((.+?)\)$/);
  const title = linkMatch ? linkMatch[1] : titleCell;
  const path = linkMatch ? linkMatch[2] : '';
  const strikethrough = /^\[~~/.test(titleCell);

  // Extract slug from path: TODO/003-fix-login-bug.md or TODO/DONE/003-fix-login-bug.md
  const slugMatch = path.match(/(\d{3}-.+?)\.md$/);
  const slug = slugMatch ? slugMatch[1] : '';

  return {
    number,
    title,
    path,
    slug,
    strikethrough,
    priority: cells[2] || '',
    status: cells[3] || '',
    created: cells[4] || '',
    changed: cells[5] || '',
    raw: row,
  };
}

/** Generate a URL-safe slug from a title. */
function makeSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');
}

/** Get the next counter value from TODO.md content. */
function getNextCounter(content) {
  const match = content.match(/<!-- next: (\d+) -->/);
  return match ? parseInt(match[1], 10) : 1;
}

/** Pad a number to 3 digits. */
function pad(n) {
  return String(n).padStart(3, '0');
}

/** Get current datetime in YYYY-MM-DD HH:MM format. */
function now() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0');
}

/** Find row by 3-digit padded number. Returns { row, parsed, index } or null. */
function findByNumber(content, num) {
  const padded = pad(parseInt(num.replace(/^#/, ''), 10));
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(`| ${padded} |`)) {
      return { row: lines[i], parsed: parseRow(lines[i]), index: i };
    }
  }
  return null;
}

/** Replace a line at a given index in content. */
function replaceLine(content, index, newLine) {
  const lines = content.split('\n');
  lines[index] = newLine;
  return lines.join('\n');
}

/** Remove a line at a given index in content. */
function removeLine(content, index) {
  const lines = content.split('\n');
  lines.splice(index, 1);
  return lines.join('\n');
}

/** Build a table row string. */
function buildRow(number, title, slug, priority, status, created, changed, done = false) {
  const dir = done ? 'TODO/DONE' : 'TODO';
  const linkText = done ? `~~${title}~~` : title;
  return `| ${number} | [${linkText}](${dir}/${number}-${slug}.md) | ${priority} | ${status} | ${created} | ${changed} |`;
}

// --- Subcommands ---

function cmdInit() {
  if (existsSync(TODO_FILE)) {
    console.log('exists');
  } else {
    writeTodo(SKELETON);
    console.log('created');
  }
}

function cmdNextId(titleWords) {
  if (!titleWords.length) die('usage: next-id <title words>');
  const title = titleWords.join(' ');
  const content = readTodo();
  const n = getNextCounter(content);
  const padded = pad(n);
  let slug = makeSlug(title);

  // Check for slug collision
  const existing = parseRows(content).map(r => parseRow(r).slug);
  let candidate = `${padded}-${slug}`;
  let suffix = 2;
  while (existing.includes(candidate) || existsSync(join(TODO_DIR, `${candidate}.md`))) {
    candidate = `${padded}-${slug}-${suffix}`;
    suffix++;
  }
  const finalSlug = candidate.slice(4); // remove "NNN-" prefix since we return them separately

  // Increment counter
  const updated = content.replace(/<!-- next: \d+ -->/, `<!-- next: ${n + 1} -->`);
  writeTodo(updated);

  console.log(`${padded} ${finalSlug}`);
}

function cmdList() {
  if (!existsSync(TODO_FILE)) {
    console.log('No TODO.md found.');
    return;
  }
  const content = readTodo();
  const rows = parseRows(content).map(parseRow);

  if (rows.length === 0) {
    console.log('No todos yet.');
    return;
  }

  const active = rows.filter(r => r.status === 'Active');
  const open = rows.filter(r => r.status === 'Open');
  const done = rows.filter(r => r.status === 'Done \u2713');
  const ordered = [...active, ...open, ...done];

  // Calculate column widths
  const headers = ['No', 'Title', 'Priority', 'Status', 'Created', 'Changed'];
  const widths = headers.map(h => h.length);
  for (const r of ordered) {
    widths[0] = Math.max(widths[0], r.number.length);
    widths[1] = Math.max(widths[1], r.title.length);
    widths[2] = Math.max(widths[2], r.priority.length);
    widths[3] = Math.max(widths[3], r.status.length);
    widths[4] = Math.max(widths[4], r.created.length);
    widths[5] = Math.max(widths[5], r.changed.length);
  }

  console.log('Todos in TODO.md:\n');
  const hdr = headers.map((h, i) => h.padEnd(widths[i])).join('   ');
  console.log(`  ${hdr}`);
  for (const r of ordered) {
    const cols = [
      r.number.padEnd(widths[0]),
      r.title.padEnd(widths[1]),
      r.priority.padEnd(widths[2]),
      r.status.padEnd(widths[3]),
      r.created.padEnd(widths[4]),
      r.changed.padEnd(widths[5]),
    ];
    console.log(`  ${cols.join('   ')}`);
  }
}

function cmdFind(numArg) {
  if (!numArg) die('usage: find <number>');
  const content = readTodo();
  const result = findByNumber(content, numArg);
  if (!result) die(`no todo with number ${numArg}`);
  const p = result.parsed;
  console.log(`number=${p.number}`);
  console.log(`title=${p.title}`);
  console.log(`slug=${p.slug}`);
  console.log(`path=${p.path}`);
  console.log(`status=${p.status}`);
  console.log(`priority=${p.priority}`);
  console.log(`created=${p.created}`);
  console.log(`changed=${p.changed}`);
  console.log(`strikethrough=${p.strikethrough ? 'yes' : 'no'}`);
}

function cmdRows() {
  const content = readTodo();
  const rows = parseRows(content);
  for (const row of rows) {
    console.log(row);
  }
}

function cmdAddRow(args) {
  // args: NNN slug title priority datetime
  if (args.length < 4) die('usage: add-row <NNN> <slug> <title> <priority> <datetime>');
  const [number, slug, title, priority, datetime] = args;
  const content = readTodo();
  const lines = content.split('\n');

  // Find the blank line before "---" separator (or the --- itself)
  let insertAt = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^---\s*$/.test(lines[i]) && i > 0) {
      // Insert before the blank line preceding ---, or before --- if no blank line
      insertAt = (lines[i - 1].trim() === '') ? i - 1 : i;
      break;
    }
  }
  if (insertAt === -1) die('could not find --- separator in TODO.md');

  const row = `| ${number} | [${title}](TODO/${number}-${slug}.md) | ${priority} | Open | ${datetime} | ${datetime} |`;
  lines.splice(insertAt, 0, row);
  writeTodo(lines.join('\n'));
  console.log('ok');
}

function cmdUpdateStatus(args) {
  if (args.length < 3) die('usage: update-status <NNN> <status> <datetime>');
  const [numArg, status, datetime] = args;
  const content = readTodo();
  const result = findByNumber(content, numArg);
  if (!result) die(`no todo with number ${numArg}`);

  const p = result.parsed;
  const dir = p.path.startsWith('TODO/DONE') ? 'TODO/DONE' : 'TODO';
  const linkText = p.strikethrough ? `~~${p.title}~~` : p.title;
  const newRow = `| ${p.number} | [${linkText}](${dir}/${p.slug}.md) | ${p.priority} | ${status} | ${p.created} | ${datetime} |`;
  writeTodo(replaceLine(content, result.index, newRow));
  console.log('ok');
}

function cmdDoneRow(args) {
  if (args.length < 2) die('usage: done-row <NNN> <datetime>');
  const [numArg, datetime] = args;
  const content = readTodo();
  const result = findByNumber(content, numArg);
  if (!result) die(`no todo with number ${numArg}`);

  const p = result.parsed;
  const newRow = `| ${p.number} | [~~${p.title}~~](TODO/DONE/${p.slug}.md) | ${p.priority} | Done \u2713 | ${p.created} | ${datetime} |`;
  writeTodo(replaceLine(content, result.index, newRow));
  console.log(p.slug);
}

function cmdReopenRow(args) {
  if (args.length < 2) die('usage: reopen-row <NNN> <datetime>');
  const [numArg, datetime] = args;
  const content = readTodo();
  const result = findByNumber(content, numArg);
  if (!result) die(`no todo with number ${numArg}`);

  const p = result.parsed;
  const newRow = `| ${p.number} | [${p.title}](TODO/${p.slug}.md) | ${p.priority} | Open | ${p.created} | ${datetime} |`;
  writeTodo(replaceLine(content, result.index, newRow));
  console.log(p.slug);
}

function cmdRemoveRow(numArg) {
  if (!numArg) die('usage: remove-row <number>');
  const content = readTodo();
  const result = findByNumber(content, numArg);
  if (!result) die(`no todo with number ${numArg}`);

  writeTodo(removeLine(content, result.index));
  console.log(result.parsed.path);
}

function cmdMoveDone(slug) {
  if (!slug) die('usage: move-done <slug>');
  const src = join(TODO_DIR, `${slug}.md`);
  const dst = join(DONE_DIR, `${slug}.md`);
  if (!existsSync(src)) die(`file not found: ${src}`);
  mkdirSync(DONE_DIR, { recursive: true });
  renameSync(src, dst);
  console.log('ok');
}

function cmdMoveOpen(slug) {
  if (!slug) die('usage: move-open <slug>');
  const src = join(DONE_DIR, `${slug}.md`);
  const dst = join(TODO_DIR, `${slug}.md`);
  if (!existsSync(src)) die(`file not found: ${src}`);
  renameSync(src, dst);
  console.log('ok');
}

function cmdMeta() {
  let user;
  try {
    user = userInfo().username;
  } catch {
    user = 'unknown';
  }
  console.log(`datetime=${now()}`);
  console.log(`user=${user}`);
}

// --- Main dispatch ---

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case 'init':
    cmdInit();
    break;
  case 'next-id':
    cmdNextId(args);
    break;
  case 'list':
    cmdList();
    break;
  case 'find':
    cmdFind(args[0]);
    break;
  case 'rows':
    cmdRows();
    break;
  case 'add-row':
    cmdAddRow(args);
    break;
  case 'update-status':
    cmdUpdateStatus(args);
    break;
  case 'done-row':
    cmdDoneRow(args);
    break;
  case 'reopen-row':
    cmdReopenRow(args);
    break;
  case 'remove-row':
    cmdRemoveRow(args[0]);
    break;
  case 'move-done':
    cmdMoveDone(args[0]);
    break;
  case 'move-open':
    cmdMoveOpen(args[0]);
    break;
  case 'meta':
    cmdMeta();
    break;
  default:
    die(`unknown command: ${cmd}\nCommands: init, next-id, list, find, rows, add-row, update-status, done-row, reopen-row, remove-row, move-done, move-open, meta`);
}
