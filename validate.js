// Sanity-checks a generated data directory before it is allowed to become a
// release. Exits non-zero (and prints every failing rule) when the data is
// structurally broken or looks truncated compared to a baseline directory.
//
//   node validate.js [dir] [--baseline <dir>]
//
// `dir` defaults to ./data, `--baseline` defaults to ./data when a different
// directory is being validated.

const fs = require("fs");
const path = require("path");

const LEVELS = [
  { file: "provinces", pattern: /^\d{2}$/, parent: null, floor: 30 },
  { file: "cities", pattern: /^\d{2}\.\d{2}$/, parent: { file: "provinces", key: "province_id" }, floor: 400 },
  { file: "districts", pattern: /^\d{2}\.\d{2}\.\d{2}$/, parent: { file: "cities", key: "city_id" }, floor: 6000 },
  {
    file: "villages",
    pattern: /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/,
    parent: { file: "districts", key: "district_id" },
    floor: 70000,
  },
];

// A release that loses more than this share of its rows is treated as a
// truncated upstream response rather than a real administrative change.
const MAX_SHRINK = 0.05;

// Upstream pairs regions by BPS code while we publish Dagri codes, and the two
// disagree for a small number of rows (a village whose Dagri code points at a
// different district than the one it was fetched under). Those are reported as
// warnings; only a sudden spike above this share means the hierarchy broke.
const MAX_PREFIX_MISMATCH = 0.01;
const MAX_REPORTED = 10;

const args = process.argv.slice(2);
const baselineFlag = args.indexOf("--baseline");
const baselineDir = baselineFlag !== -1 ? args[baselineFlag + 1] : null;
const positional = args.filter((a, i) => a !== "--baseline" && i !== baselineFlag + 1);

const dir = path.resolve(positional[0] || "data");
const baseline = baselineDir
  ? path.resolve(baselineDir)
  : path.resolve("data") !== dir
    ? path.resolve("data")
    : null;

const errors = [];
const fail = (msg) => errors.push(msg);

function report(rule, offenders, describe) {
  if (!offenders.length) return;
  const shown = offenders.slice(0, MAX_REPORTED).map(describe).join("; ");
  const more = offenders.length > MAX_REPORTED ? ` (+${offenders.length - MAX_REPORTED} more)` : "";
  fail(`${rule}: ${offenders.length} row(s) - ${shown}${more}`);
}

function load(directory, file) {
  const filePath = path.join(directory, `${file}.json`);
  if (!fs.existsSync(filePath)) throw new Error(`${filePath} is missing`);

  const raw = fs.readFileSync(filePath, "utf8");
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${filePath} is not valid JSON: ${e.message}`);
  }

  if (!Array.isArray(parsed)) throw new Error(`${filePath} is not a JSON array`);
  if (!parsed.length) throw new Error(`${filePath} is empty`);

  return parsed;
}

function main() {
  console.log(`Validating ${dir}${baseline ? ` (baseline ${baseline})` : ""}`);

  const data = {};

  for (const level of LEVELS) {
    try {
      data[level.file] = load(dir, level.file);
    } catch (e) {
      fail(e.message);
    }
  }

  if (errors.length) return finish();

  for (const level of LEVELS) {
    const rows = data[level.file];
    const name = level.file;

    if (rows.length < level.floor) {
      fail(`${name}: ${rows.length} rows is below the hard floor of ${level.floor}`);
    }

    report(
      `${name}: ids must run 1..n in order`,
      rows.filter((r, i) => r.id !== i + 1),
      (r) => `id ${r.id}`,
    );

    report(
      `${name}: malformed code`,
      rows.filter((r) => typeof r.code !== "string" || !level.pattern.test(r.code)),
      (r) => `id ${r.id} code ${JSON.stringify(r.code)}`,
    );

    report(
      `${name}: blank or non-string name`,
      rows.filter((r) => typeof r.name !== "string" || !r.name.trim()),
      (r) => `id ${r.id} code ${r.code}`,
    );

    const seen = new Set();
    report(
      `${name}: duplicate code`,
      rows.filter((r) => {
        if (seen.has(r.code)) return true;
        seen.add(r.code);
        return false;
      }),
      (r) => `code ${r.code}`,
    );

    // Generation walks parents in order and sorts each batch of children by
    // code, so rows must be grouped by parent (parent ids never decreasing) and
    // ascending by code inside each group. A global code sort would be wrong
    // here because a handful of rows carry a code that disagrees with the
    // parent they were fetched under.
    const parentKey = level.parent ? level.parent.key : null;

    report(
      `${name}: rows are not in deterministic order`,
      rows.filter((r, i) => {
        if (i === 0) return false;
        const previous = rows[i - 1];

        if (!parentKey) return previous.code >= r.code;
        if (r[parentKey] < previous[parentKey]) return true;
        return r[parentKey] === previous[parentKey] && previous.code >= r.code;
      }),
      (r) => `code ${r.code}`,
    );

    if (level.parent) {
      const parents = new Map(data[level.parent.file].map((p) => [p.id, p]));

      report(
        `${name}: ${level.parent.key} has no matching ${level.parent.file} row`,
        rows.filter((r) => !parents.has(r[level.parent.key])),
        (r) => `code ${r.code} -> ${level.parent.key} ${r[level.parent.key]}`,
      );

      const mismatched = rows.filter((r) => {
        const parent = parents.get(r[level.parent.key]);
        return parent && !r.code.startsWith(`${parent.code}.`);
      });

      if (mismatched.length) {
        const share = mismatched.length / rows.length;
        const sample = mismatched
          .slice(0, MAX_REPORTED)
          .map((r) => `${r.code} under ${parents.get(r[level.parent.key]).code}`)
          .join("; ");

        if (share > MAX_PREFIX_MISMATCH) {
          fail(
            `${name}: ${mismatched.length} row(s) (${(share * 100).toFixed(2)}%) do not extend their parent code, ` +
              `above the ${(MAX_PREFIX_MISMATCH * 100).toFixed(0)}% limit - ${sample}`,
          );
        } else {
          console.warn(
            `  warning: ${mismatched.length} ${name} row(s) do not extend their parent code - ${sample}`,
          );
        }
      }

      const withChildren = new Set(rows.map((r) => r[level.parent.key]));
      const childless = data[level.parent.file].filter((p) => !withChildren.has(p.id));
      if (childless.length) {
        console.warn(
          `  warning: ${childless.length} ${level.parent.file} row(s) have no ${name} ` +
            `(${childless.slice(0, MAX_REPORTED).map((p) => p.code).join(", ")})`,
        );
      }
    }

    console.log(`  ${name}: ${rows.length} rows`);
  }

  if (baseline) {
    for (const level of LEVELS) {
      let previous;

      try {
        previous = load(baseline, level.file);
      } catch (e) {
        console.warn(`  warning: no baseline for ${level.file} (${e.message})`);
        continue;
      }

      const now = data[level.file].length;
      const shrink = (previous.length - now) / previous.length;

      if (shrink > MAX_SHRINK) {
        fail(
          `${level.file}: ${now} rows is ${(shrink * 100).toFixed(1)}% fewer than the baseline ` +
            `${previous.length}, above the ${(MAX_SHRINK * 100).toFixed(0)}% limit`,
        );
      }
    }
  }

  finish();
}

function finish() {
  if (!errors.length) {
    console.log("Validation passed.");
    return;
  }

  console.error(`\nValidation failed with ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

main();
