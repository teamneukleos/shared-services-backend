import { readFileSync, writeFileSync } from "node:fs";

const file =
  "src/modules/authentication/infrastructure/prisma-authentication.repository.spec.ts";
let source = readFileSync(file, "utf8");
source = source.replace(
  /officialEmail: ('[^']+'),\n(\s*)roleAssignments:/g,
  "officialEmail: $1,\n$2employeeId: null,\n$2roleAssignments:",
);
writeFileSync(file, source);
console.log("ok");
