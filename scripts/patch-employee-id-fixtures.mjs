import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "src/modules/authentication/application/authentication.service.spec.ts",
  "src/modules/authentication/infrastructure/prisma-authentication.repository.spec.ts",
  "src/modules/authentication/decorators/current-user.decorator.spec.ts",
  "src/modules/authentication/guards/jwt-auth.guard.spec.ts",
];

for (const file of files) {
  let source = readFileSync(file, "utf8");
  const next = source.replace(
    /email: ('[^']+'|"[^"]+"),\n(\s*)permissions:/g,
    "email: $1,\n$2employeeId: null,\n$2permissions:",
  );
  if (next !== source) {
    writeFileSync(file, next);
    console.log(`updated ${file}`);
  } else {
    console.log(`unchanged ${file}`);
  }
}
