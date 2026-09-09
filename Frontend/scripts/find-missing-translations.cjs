const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
const localeData = {};
for (const file of files) {
  const code = file.replace('.json', '');
  localeData[code] = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
}

function scanDir(dir) {
  let results = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      results = results.concat(scanDir(full));
    } else if (item.endsWith('.jsx') || item.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

const allJsFiles = scanDir(path.join(__dirname, '..', 'src'));
const usedKeys = new Map();

const tRegex = /\bt\(\s*["']([a-zA-Z0-9_.]+)["'](?:\s*,\s*([^)]+))?\)/g;

for (const file of allJsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = tRegex.exec(content)) !== null) {
    const key = match[1];
    let fallback = match[2] ? match[2].trim() : '';
    if (!usedKeys.has(key)) {
      usedKeys.set(key, { files: new Set(), fallback });
    }
    usedKeys.get(key).files.add(path.relative(path.join(__dirname, '..', 'src'), file));
  }
}

const missing = [];

for (const [key, info] of usedKeys.entries()) {
  const parts = key.split('.');
  let curKn = localeData.kn;
  let curEn = localeData.en;
  let inKn = true;
  let inEn = true;
  for (const p of parts) {
    if (curKn && curKn[p] !== undefined) curKn = curKn[p];
    else { inKn = false; break; }
  }
  for (const p of parts) {
    if (curEn && curEn[p] !== undefined) curEn = curEn[p];
    else { inEn = false; break; }
  }
  if (!inKn || !inEn) {
    missing.push({ key, inEn, inKn, fallback: info.fallback, files: Array.from(info.files) });
  }
}

console.log(`Found ${missing.length} keys with missing translations in en or kn:`);
missing.forEach(m => {
  console.log(`Key: ${m.key} | inEn: ${m.inEn} | inKn: ${m.inKn} | fallback: ${m.fallback} | file: ${m.files[0]}`);
});
