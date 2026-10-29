// Rehearsal helper: node scripts/compare-db-dump.mjs <persist-dir> <out.json> dumps every table (sorted rows) so two
// local copies (before/after a migration) can be compared row for row. Used for 0007.
// Dump every user table (all rows, sorted) plus child-table schemas, for a persist dir → JSON file.
import { execSync } from "node:child_process";
import fs from "node:fs";
const [p, out] = process.argv.slice(2);
const q = (sql) => JSON.parse(execSync(`npx.cmd wrangler d1 execute raasta-db --local --persist-to ${p} --json --command "${sql}"`, { stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 }).toString())[0].results;
const tables = q("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations' ORDER BY name").map((r) => r.name);
const res = { __fk: q("PRAGMA foreign_key_check").length, __schema: q("SELECT name, sql FROM sqlite_master WHERE name IN ('requirements','saved_scholarships','applications','error_reports','tasks')") };
for (const t of tables) res[t] = q(`SELECT * FROM ${t}`).map((r) => JSON.stringify(r)).sort();
fs.writeFileSync(out, JSON.stringify(res));
console.log(tables.length, "tables");
