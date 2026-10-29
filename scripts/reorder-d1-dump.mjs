// Restore helper: node scripts/reorder-d1-dump.mjs <backup.sql> <out.sql>
// `wrangler d1 export` writes tables in creation order. Since 0007 rebuilt `scholarships` and `discoveries`, they come
// after the tables that reference them, and D1 always enforces foreign keys, so the raw export fails to load
// ("no such table: main.scholarships"). This rewrites the file with each table's CREATE + INSERTs placed after the
// tables it REFERENCES. Indexes and everything else keep their place at the end. Data is not changed.
import fs from "node:fs";
const [src, out] = process.argv.slice(2);
const lines = fs.readFileSync(src, "utf8").split("\n");

const head = [], tail = [], blocks = new Map(); // table -> lines
let cur = null;
for (const line of lines) {
  const create = line.match(/^CREATE TABLE (?:IF NOT EXISTS )?"?([A-Za-z0-9_]+)"?/);
  if (create) { cur = create[1]; blocks.set(cur, [line]); continue; }
  if (/^CREATE (UNIQUE )?INDEX|^CREATE TRIGGER|^CREATE VIEW/.test(line)) cur = null;
  if (cur) blocks.get(cur).push(line);
  else (blocks.size ? tail : head).push(line);
}

// A table's CREATE statement ends at the first line ending in ");" — references are read from that part only.
const deps = new Map();
for (const [t, ls] of blocks) {
  const end = ls.findIndex((l) => /\);\s*$/.test(l));
  const ddl = ls.slice(0, end + 1).join("\n");
  deps.set(t, [...ddl.matchAll(/REFERENCES\s+"?([A-Za-z0-9_]+)"?/gi)].map((m) => m[1]).filter((d) => d !== t && blocks.has(d)));
}
const order = [], seen = new Set();
const visit = (t, path = []) => {
  if (seen.has(t)) return;
  if (path.includes(t)) throw new Error("reference cycle: " + [...path, t].join(" -> "));
  for (const d of deps.get(t)) visit(d, [...path, t]);
  seen.add(t); order.push(t);
};
for (const t of blocks.keys()) visit(t);

fs.writeFileSync(out, [...head, ...order.flatMap((t) => blocks.get(t)), ...tail].join("\n"));
console.log(order.length, "tables reordered:", order.join(", "));
