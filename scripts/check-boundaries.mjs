import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const roots = ["apps/api/src", "apps/web/src", "packages/shared/src"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const forbidden = [
  {
    pattern: /ANTHROPIC|Anthropic|anthropic|claude/,
    message: "Anthropic reference found.",
  },
];

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else if (sourceExtensions.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files;
}

const files = (await Promise.all(roots.map(listFiles))).flat();
const violations = [];

for (const file of files) {
  const content = await readFile(file, "utf8");
  if (
    (file.startsWith("apps/web") || file.startsWith("packages/shared")) &&
    /(?:from|import|require\()\s*["']memo-grafter(?:\/[^"']*)?["']/.test(content)
  ) {
    violations.push(`${file}: Frontend/shared code imports memo-grafter.`);
  }
  for (const rule of forbidden) {
    if (rule.pattern.test(content)) {
      violations.push(`${file}: ${rule.message}`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Boundary checks passed.");
}
