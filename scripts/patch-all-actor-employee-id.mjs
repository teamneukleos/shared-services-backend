import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walk(full, out);
    } else if (entry.endsWith(".spec.ts") || entry.endsWith(".e2e-spec.ts")) {
      out.push(full);
    }
  }
  return out;
}

const files = walk("src").concat(walk("test"));
let changed = 0;

for (const file of files) {
  let source = readFileSync(file, "utf8");
  const next = source.replace(
    /email: ('[^']+'|"[^"]+"),\n(\s*)permissions:/g,
    (match, email, indent) => {
      // Skip if employeeId already present immediately after email
      return `email: ${email},\n${indent}employeeId: null,\n${indent}permissions:`;
    },
  );

  // Avoid double-inserting
  const cleaned = next.replace(
    /employeeId: null,\n(\s*)employeeId: null,\n/g,
    "employeeId: null,\n$1",
  );

  if (cleaned !== source) {
    writeFileSync(file, cleaned);
    changed += 1;
    console.log(file);
  }
}

console.log(`updated ${changed} files`);
