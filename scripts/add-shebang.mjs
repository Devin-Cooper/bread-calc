import { readFileSync, writeFileSync, chmodSync } from "node:fs";
const path = "dist/cli/bin.js";
const banner = "#!/usr/bin/env node\n";
const body = readFileSync(path, "utf8");
writeFileSync(path, banner + body);
chmodSync(path, 0o755);
console.error(`shebang + chmod 755: ${path}`);
