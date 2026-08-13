// Compares two data directories and reports whether the newly generated data
// actually differs from what is already published. Used as the release gate so
// an unchanged month does not produce an empty release.
//
//   node compare.js <new-dir> [old-dir]
//
// `old-dir` defaults to ./data. Rows are matched by `code`, not by `id`, so the
// summary describes real administrative changes. When GITHUB_OUTPUT is set the
// script also writes `changed=true|false` and a markdown `summary` for the
// workflow to consume. Always exits 0 - a difference is an outcome, not a
// failure.

const fs = require("fs");
const path = require("path");

const LEVELS = [
  { file: "provinces", parentKey: null },
  { file: "cities", parentKey: "province_id" },
  { file: "districts", parentKey: "city_id" },
  { file: "villages", parentKey: "district_id" },
];

const MAX_LISTED = 20;

const newDir = path.resolve(process.argv[2] || "build");
const oldDir = path.resolve(process.argv[3] || "data");

function load(directory, file) {
  const filePath = path.join(directory, `${file}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

// Resolves a row's parent code so a reparented region is reported as a change
// even though its own code and name stayed the same.
function index(rows, parentRows, parentKey) {
  const parents = parentRows ? new Map(parentRows.map((p) => [p.id, p.code])) : null;
  const map = new Map();

  for (const row of rows) {
    map.set(row.code, {
      name: row.name,
      parent: parents ? parents.get(row[parentKey]) : null,
    });
  }

  return map;
}

function diffLevel(level, next, previous) {
  if (!previous) return { added: [...next.keys()], removed: [], renamed: [], moved: [] };

  const added = [];
  const removed = [];
  const renamed = [];
  const moved = [];

  for (const [code, row] of next) {
    const before = previous.get(code);

    if (!before) {
      added.push(code);
      continue;
    }

    if (before.name !== row.name) renamed.push(`${code} ${before.name} -> ${row.name}`);
    if (before.parent !== row.parent) moved.push(`${code} ${before.parent} -> ${row.parent}`);
  }

  for (const code of previous.keys()) {
    if (!next.has(code)) removed.push(code);
  }

  return { added, removed, renamed, moved };
}

function main() {
  const lines = [];
  let changed = false;

  console.log(`Comparing ${newDir} against ${oldDir}`);

  const nextData = {};
  const prevData = {};

  for (const level of LEVELS) {
    nextData[level.file] = load(newDir, level.file);
    prevData[level.file] = load(oldDir, level.file);

    if (!nextData[level.file]) {
      console.error(`Missing ${path.join(newDir, `${level.file}.json`)}`);
      process.exit(1);
    }
  }

  for (const level of LEVELS) {
    const parentLevel = LEVELS[LEVELS.indexOf(level) - 1];
    const next = index(nextData[level.file], parentLevel ? nextData[parentLevel.file] : null, level.parentKey);
    const previous = prevData[level.file]
      ? index(prevData[level.file], parentLevel ? prevData[parentLevel.file] : null, level.parentKey)
      : null;

    const { added, removed, renamed, moved } = diffLevel(level, next, previous);
    const total = added.length + removed.length + renamed.length + moved.length;

    if (!total) {
      console.log(`  ${level.file}: unchanged (${next.size} rows)`);
      continue;
    }

    changed = true;
    console.log(
      `  ${level.file}: ${added.length} added, ${removed.length} removed, ` +
        `${renamed.length} renamed, ${moved.length} reparented`,
    );

    const parts = [];
    if (added.length) parts.push(`${added.length} added`);
    if (removed.length) parts.push(`${removed.length} removed`);
    if (renamed.length) parts.push(`${renamed.length} renamed`);
    if (moved.length) parts.push(`${moved.length} reparented`);
    lines.push(`- **${level.file}**: ${parts.join(", ")}`);

    for (const [label, items] of [
      ["added", added],
      ["removed", removed],
      ["renamed", renamed],
      ["reparented", moved],
    ]) {
      for (const item of items.slice(0, MAX_LISTED)) console.log(`    ${label}: ${item}`);
      if (items.length > MAX_LISTED) console.log(`    ${label}: +${items.length - MAX_LISTED} more`);
    }
  }

  console.log(changed ? "\nData changed." : "\nData is identical - no release needed.");

  const summary = changed ? lines.join("\n") : "No changes.";
  fs.writeFileSync(path.join(newDir, "summary.md"), `${summary}\n`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  }
}

main();
