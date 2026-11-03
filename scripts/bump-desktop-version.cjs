const fs = require('node:fs');
const path = require('node:path');

const packagePath = path.resolve(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const versionMatch = /^(\d+)\.(\d+)\.(\d+)$/.exec(packageJson.version);

if (!versionMatch) {
  throw new Error(`Cannot automatically increment unsupported version: ${packageJson.version}`);
}

packageJson.version = `${versionMatch[1]}.${versionMatch[2]}.${Number(versionMatch[3]) + 1}`;
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log(`Building desktop release ${packageJson.version}`);
